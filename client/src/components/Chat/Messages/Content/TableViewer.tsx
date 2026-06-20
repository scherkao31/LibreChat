import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Maximize2, Download, FileDown, Pencil, Check, FileSpreadsheet } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';
import DeckAnnotate from '~/components/Chat/Messages/Content/DeckAnnotate';

/**
 * TableViewer — widget inline pour un TABLEAU de donnees (`lancya_table`). Contrairement
 * aux visuels a canevas fixe, un tableau a une hauteur variable : on auto-dimensionne
 * l'iframe a la hauteur de son contenu (height postee par un script injecte). Le modele
 * emet le HTML complet et autonome (au moins un <table>, palette en variables CSS :root).
 *
 * Pouvoirs partages avec les autres widgets : edition du texte (cellules contentEditable),
 * couleurs (:root), persistance dans le message, export PDF (A4 paysage via Gotenberg) et
 * annotation (le crayon). En plus, propre au tableau : export CSV (lisible dans Excel).
 */

const INJECT = `<style id="lt-style">
  html, body { margin: 0; background: transparent; }
  [contenteditable="true"] { outline: none; }
</style>
<script id="lt-script">
(function(){
  function report(){
    var hgt = Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement.scrollHeight);
    try { parent.postMessage({ lancyaTableHeight: true, height: hgt }, '*'); } catch (e) {}
  }
  window.addEventListener('load', report);
  window.addEventListener('resize', report);
  document.addEventListener('input', report);
  try { new ResizeObserver(report).observe(document.documentElement); } catch (e) {}
  report();
})();
</script>`;

const COLOR_LABELS: Record<string, string> = {
  accent: 'Accent',
  bg: 'Fond',
  text: 'Texte',
  'accent-2': 'Accent 2',
  muted: 'Discret',
};
const COLOR_ORDER = ['accent', 'bg', 'text', 'accent-2', 'muted'];

type PaletteEntry = { name: string; label: string; value: string };

function normalizeHex(v: string): string | null {
  const s = v.trim().toLowerCase();
  const m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    return '#' + m[1].split('').map((c) => c + c).join('');
  }
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

function parseRootColors(raw: string): PaletteEntry[] {
  const block = /:root\s*\{([^}]*)\}/i.exec(raw);
  if (!block) {
    return [];
  }
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  const seen = new Set<string>();
  const out: PaletteEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1])) !== null) {
    const name = m[1].toLowerCase();
    if (!(name in COLOR_LABELS) || seen.has(name)) {
      continue;
    }
    const hex = normalizeHex(m[2]);
    if (!hex) {
      continue;
    }
    seen.add(name);
    out.push({ name, label: COLOR_LABELS[name], value: hex });
  }
  out.sort((a, b) => COLOR_ORDER.indexOf(a.name) - COLOR_ORDER.indexOf(b.name));
  return out;
}

function looksComplete(raw: string): boolean {
  const t = raw.toLowerCase();
  return t.includes('</table>') || t.includes('</body>') || t.includes('</html>');
}

function buildSrcDoc(html: string): string {
  return html.includes('</body>') ? html.replace('</body>', `${INJECT}</body>`) : `${html}${INJECT}`;
}

/** Echappe une cellule pour le CSV (RFC 4180). */
function csvCell(s: string): string {
  const v = s.replace(/\s+/g, ' ').trim();
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const TableViewer = memo(function TableViewer({ raw }: { raw: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ready = looksComplete(raw);
  const srcDoc = useMemo(() => (ready ? buildSrcDoc(raw) : ''), [ready, raw]);

  const palette = useMemo(() => parseRootColors(raw), [raw]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [height, setHeight] = useState(220);
  const { messageId, conversationId, partIndex } = useMessageContext();
  const { showToast } = useToastContext();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const doc = () => iframeRef.current?.contentDocument ?? null;

  // L'iframe poste sa hauteur de contenu ; on dimensionne le cadre dessus (borne).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const data = e.data;
      if (data && data.lancyaTableHeight && typeof data.height === 'number') {
        setHeight(Math.min(2000, Math.max(120, Math.ceil(data.height))));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const cleanEditedHtml = useCallback((): string | null => {
    const d = doc();
    if (!d) {
      return null;
    }
    const clone = d.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#lt-style, #lt-script').forEach((el) => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
    return `<!DOCTYPE html>\n${clone.outerHTML}`;
  }, []);

  const persist = useCallback(() => {
    if (!messageId || !conversationId || partIndex == null) {
      return;
    }
    const html = cleanEditedHtml();
    if (!html) {
      return;
    }
    const text = '```lancya_table\n' + html + '\n```';
    void dataService
      .updateMessageContent({ conversationId, messageId, index: partIndex, text })
      .catch(() => undefined);
  }, [messageId, conversationId, partIndex, cleanEditedHtml]);

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    persistTimer.current = setTimeout(persist, 800);
  }, [persist]);

  const applyEditing = useCallback((on: boolean) => {
    const d = doc();
    if (!d) {
      return;
    }
    d.querySelectorAll('th, td').forEach((c) => {
      (c as HTMLElement).contentEditable = on ? 'true' : 'false';
    });
  }, []);

  const handleLoad = useCallback(() => {
    const d = doc();
    if (!d) {
      return;
    }
    const root = d.documentElement;
    Object.entries(overridesRef.current).forEach(([name, value]) => {
      root.style.setProperty(`--${name}`, value);
    });
    applyEditing(editingRef.current);
    d.addEventListener('input', schedulePersist);
  }, [applyEditing, schedulePersist]);

  const setColor = useCallback(
    (name: string, value: string) => {
      setOverrides((prev) => ({ ...prev, [name]: value }));
      doc()?.documentElement.style.setProperty(`--${name}`, value);
      schedulePersist();
    },
    [schedulePersist],
  );

  const toggleEditing = useCallback(() => {
    setEditing((prev) => {
      const next = !prev;
      applyEditing(next);
      if (!next) {
        persist();
      }
      return next;
    });
  }, [applyEditing, persist]);

  const goFullscreen = useCallback(() => {
    iframeRef.current?.requestFullscreen?.();
  }, []);

  const download = useCallback(() => {
    try {
      const live = doc()?.documentElement?.outerHTML;
      const finalHtml = live ? `<!DOCTYPE html>\n${live}` : srcDoc;
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tableau.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* indisponible */
    }
  }, [srcDoc]);

  // CSV depuis le tableau VIVANT (donc avec les editions). BOM pour les accents dans Excel.
  const downloadCsv = useCallback(() => {
    const d = doc();
    const table = d?.querySelector('table');
    if (!table) {
      showToast?.({ message: 'Aucun tableau a exporter.', status: 'error' });
      return;
    }
    const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th, td'))
        .map((c) => csvCell(c.textContent || ''))
        .join(','),
    );
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tableau.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [showToast]);

  // PDF A4 paysage (les tableaux sont souvent larges) via Gotenberg.
  const downloadPdf = useCallback(async () => {
    const clean = cleanEditedHtml();
    if (!clean) {
      return;
    }
    setPdfLoading(true);
    try {
      const resp = await axios.post(
        '/api/deck/pdf',
        { html: clean, paperWidth: 11.69, paperHeight: 8.27, margin: 0.4 },
        { responseType: 'arraybuffer' },
      );
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tableau.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast?.({ message: "L'export PDF n'est pas disponible pour le moment.", status: 'error' });
    } finally {
      setPdfLoading(false);
    }
  }, [cleanEditedHtml, showToast]);

  if (!ready) {
    return (
      <div className="not-prose my-3 flex h-28 w-full items-center justify-center rounded-2xl border border-border-medium bg-surface-secondary text-sm text-text-secondary shadow-sm">
        Preparation du tableau...
      </div>
    );
  }

  const colorValue = (e: PaletteEntry) => overrides[e.name] ?? e.value;

  return (
    <div className="not-prose my-3 w-full font-sans">
      <div
        className={cn(
          'overflow-hidden rounded-2xl border bg-surface-secondary shadow-sm',
          editing ? 'border-border-heavy ring-2 ring-border-heavy' : 'border-border-medium',
        )}
      >
        <div className="relative">
          <iframe
            ref={iframeRef}
            title="Tableau"
            srcDoc={srcDoc}
            onLoad={handleLoad}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block w-full border-0 bg-white"
            style={{ height }}
          />
          <DeckAnnotate iframeRef={iframeRef} kind="ce tableau" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-light px-3 py-2">
          {palette.length > 0 && (
            <div className="mr-auto flex items-center gap-2">
              {palette.map((entry) => (
                <label
                  key={entry.name}
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary"
                  title={entry.label}
                >
                  <input
                    type="color"
                    value={colorValue(entry)}
                    onChange={(ev) => setColor(entry.name, ev.target.value)}
                    className="h-5 w-5 cursor-pointer rounded border border-border-medium bg-transparent p-0"
                    aria-label={`Couleur ${entry.label}`}
                  />
                  <span className="hidden sm:inline">{entry.label}</span>
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={toggleEditing}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
              editing
                ? 'bg-surface-tertiary text-text-primary'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
              'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            )}
          >
            {editing ? <Check size={14} /> : <Pencil size={14} />}
            {editing ? 'Terminer' : 'Editer les cellules'}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
              'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            )}
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfLoading}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
              'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
              pdfLoading && 'cursor-not-allowed opacity-50',
            )}
          >
            <FileDown size={14} />
            {pdfLoading ? 'PDF...' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={download}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
              'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            )}
          >
            <Download size={14} />
            HTML
          </button>
          <button
            type="button"
            onClick={goFullscreen}
            className={cn(
              'flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-primary',
              'transition-opacity duration-150 hover:opacity-90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            )}
          >
            <Maximize2 size={14} />
            Plein ecran
          </button>
        </div>
      </div>
      <span className="mt-1 block px-1 text-xs text-text-secondary">
        Editez les cellules, exportez en CSV (Excel) ou PDF, ou annotez (le crayon) pour demander une
        modif a l'IA.
      </span>
    </div>
  );
});

export default TableViewer;
