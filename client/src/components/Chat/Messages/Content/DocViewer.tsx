import { memo, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Maximize2, Download, FileDown, Pencil, Check } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';
import DeckAnnotate from '~/components/Chat/Messages/Content/DeckAnnotate';

/**
 * DocViewer — widget inline pour un DOCUMENT interactif (bloc `lancya_doc`) :
 * compte rendu, synthese, rapport. Cousin du widget de presentation (SlideDeck),
 * mais le contenu DEFILE (pas de slides) et l'export PDF est en A4 portrait.
 *
 * Le modele emet le HTML complet et autonome d'un document (cf. skill
 * prise-de-notes). Convention : palette en variables CSS (:root). On le rend dans
 * NOTRE iframe (srcDoc) ; comme elle est same-origin, on pilote directement :
 *  - COULEURS : pickers sur les variables :root, recoloration en direct ;
 *  - EDITION : tout le document devient contentEditable, edition directe ;
 *  - PDF : envoi du HTML propre a Gotenberg en A4 portrait ;
 *  - les modifs sont persistees dans le message (reprompt en tient compte).
 */

const INJECT_DOC_STYLE = `<style id="ld-doc-style">
  [contenteditable="true"], [contenteditable="true"]:focus { outline: none; }
</style>`;

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
    return (
      '#' +
      m[1]
        .split('')
        .map((c) => c + c)
        .join('')
    );
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
  return t.includes('</body>') || t.includes('</html>');
}

function buildSrcDoc(html: string): string {
  return html.includes('</head>')
    ? html.replace('</head>', `${INJECT_DOC_STYLE}</head>`)
    : `${INJECT_DOC_STYLE}${html}`;
}

const DocViewer = memo(function DocViewer({ raw }: { raw: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ready = looksComplete(raw);
  const srcDoc = useMemo(() => (ready ? buildSrcDoc(raw) : ''), [ready, raw]);

  const palette = useMemo(() => parseRootColors(raw), [raw]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { messageId, conversationId, partIndex } = useMessageContext();
  const { showToast } = useToastContext();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const doc = () => iframeRef.current?.contentDocument ?? null;

  /** Document propre (sans notre style injecte ni les attributs contenteditable),
   *  avec les modifs de l'utilisateur (couleurs :root + texte). */
  const cleanEditedHtml = useCallback((): string | null => {
    const d = doc();
    if (!d) {
      return null;
    }
    const clone = d.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#ld-doc-style').forEach((el) => el.remove());
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
    const text = '```lancya_doc\n' + html + '\n```';
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
    if (d?.body) {
      d.body.contentEditable = on ? 'true' : 'false';
    }
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
      a.download = 'document.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* indisponible : on ignore */
    }
  }, [srcDoc]);

  // Export PDF A4 portrait (avec marge) via Gotenberg.
  const downloadPdf = useCallback(async () => {
    const clean = cleanEditedHtml();
    if (!clean) {
      return;
    }
    setPdfLoading(true);
    try {
      const resp = await axios.post(
        '/api/deck/pdf',
        { html: clean, paperWidth: '8.27', paperHeight: '11.69', margin: '0.6' },
        { responseType: 'arraybuffer' },
      );
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
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
      <div className="not-prose my-3 flex h-40 w-full items-center justify-center rounded-2xl border border-border-medium bg-surface-secondary text-sm text-text-secondary shadow-sm">
        Preparation du document...
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
            title="Document"
            srcDoc={srcDoc}
            onLoad={handleLoad}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block h-[620px] w-full border-0 bg-white"
          />
          <DeckAnnotate iframeRef={iframeRef} kind="ce document" />
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
            {editing ? 'Terminer' : 'Editer le texte'}
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
        {editing
          ? 'Cliquez dans le document pour modifier le texte. Les couleurs se changent a gauche.'
          : 'Editez le texte, changez les couleurs, exportez en PDF ou HTML.'}
      </span>
    </div>
  );
});

export default DocViewer;
