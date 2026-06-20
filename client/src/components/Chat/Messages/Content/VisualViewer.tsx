import { memo, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Maximize2, Download, FileDown, Pencil, Check, ImageDown } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';
import { buildPerSlideHtmls, downloadImagesFromHtmls } from '~/utils/deckImages';
import ExportMenu from '~/components/Chat/Messages/Content/ExportMenu';
import DeckAnnotate from '~/components/Chat/Messages/Content/DeckAnnotate';
import { CHART_RENDER_SCRIPT } from '~/components/Chat/Messages/Content/chartRenderer';

/**
 * VisualViewer — widget inline pour un VISUEL unique (un seul canvas) : graphique
 * (`lancya_chart`), schema/diagramme (`lancya_diagram`) ou infographie
 * (`lancya_visual`). C'est le meme moteur que SlideDeck, mais pour un canvas unique :
 * le modele emet le HTML complet et autonome, avec une `<section class="slide">`
 * dimensionnee au canevas (palette en variables CSS :root). On le rend dans NOTRE
 * iframe, on le met a l'echelle pour rentrer dans le cadre, et on offre edition du
 * texte + couleurs + persistance + export PDF/PNG + annotation + plein ecran.
 *
 * Dimensions du canevas : 16:9 (1280x720) par defaut pour graphique/schema, portrait
 * (1080x1350) pour l'infographie ; surchargeables par le HTML via
 * `<meta name="lancya-canvas" content="LARGEURxHAUTEUR">`.
 */

type Variant = {
  tag: string;
  /** Pour l'annotation + la persistance ("ce graphique"...). */
  noun: string;
  /** Titre de l'iframe + base des noms de fichier. */
  title: string;
  file: string;
  w: number;
  h: number;
};

const VARIANTS: Record<string, Variant> = {
  lancya_chart: { tag: 'lancya_chart', noun: 'ce graphique', title: 'Graphique', file: 'graphique', w: 1280, h: 720 },
  lancya_diagram: { tag: 'lancya_diagram', noun: 'ce schema', title: 'Schema', file: 'schema', w: 1280, h: 720 },
  lancya_visual: { tag: 'lancya_visual', noun: 'ce visuel', title: 'Visuel', file: 'visuel', w: 1080, h: 1350 },
};

function parseCanvas(raw: string, dw: number, dh: number): { w: number; h: number } {
  const m = /<meta\s+name=["']lancya-canvas["']\s+content=["'](\d+)\s*[x×]\s*(\d+)["']/i.exec(raw);
  if (m) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (w > 0 && h > 0) {
      return { w, h };
    }
  }
  return { w: dw, h: dh };
}

const injectStyle = (w: number, h: number) => `<style id="ld-style">
  html, body { margin: 0; height: 100%; overflow: hidden; }
  .slide { position: absolute !important; top: 50% !important; left: 50% !important; width: ${w}px !important; height: ${h}px !important; margin: ${-h / 2}px 0 0 ${-w / 2}px !important; transform: scale(var(--ld-scale, 1)); transform-origin: center center; overflow: hidden; box-sizing: border-box; }
  [contenteditable="true"] { outline: none; }
  .slide[contenteditable="true"] { cursor: text; }
</style>`;

const injectScript = (w: number, h: number) => `<script id="ld-script">
(function(){
  function fit(){
    var s = Math.min(window.innerWidth / ${w}, window.innerHeight / ${h});
    document.documentElement.style.setProperty('--ld-scale', String(s));
  }
  window.addEventListener('resize', fit);
  fit();
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
  return t.includes('</body>') || t.includes('</html>');
}

function buildSrcDoc(html: string, w: number, h: number, chart: boolean): string {
  let out = html;
  out = out.includes('</head>')
    ? out.replace('</head>', `${injectStyle(w, h)}</head>`)
    : `${injectStyle(w, h)}${out}`;
  // Le renderer de graphiques tourne APRES le script d'echelle (dessine le SVG depuis
  // les donnees data-spec). Injecte uniquement pour les charts.
  const tail = injectScript(w, h) + (chart ? CHART_RENDER_SCRIPT : '');
  out = out.includes('</body>') ? out.replace('</body>', `${tail}</body>`) : `${out}${tail}`;
  return out;
}

const printStyle = (w: number, h: number) => `<style>
  @page { size: ${w}px ${h}px; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .slide { position: static !important; width: ${w}px !important; height: ${h}px !important; margin: 0 !important; transform: none !important; box-sizing: border-box; overflow: hidden; }
</style>`;
function buildPrintHtml(cleanHtml: string, w: number, h: number): string {
  return cleanHtml.includes('</head>')
    ? cleanHtml.replace('</head>', `${printStyle(w, h)}</head>`)
    : `${printStyle(w, h)}${cleanHtml}`;
}

const VisualViewer = memo(function VisualViewer({ raw, tag }: { raw: string; tag: string }) {
  const variant = VARIANTS[tag] ?? VARIANTS.lancya_visual;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ready = looksComplete(raw);
  const { w, h } = useMemo(() => parseCanvas(raw, variant.w, variant.h), [raw, variant.w, variant.h]);
  const portrait = h > w;
  const isChart = variant.tag === 'lancya_chart';
  const srcDoc = useMemo(() => (ready ? buildSrcDoc(raw, w, h, isChart) : ''), [ready, raw, w, h, isChart]);

  const palette = useMemo(() => parseRootColors(raw), [raw]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const { messageId, conversationId, partIndex } = useMessageContext();
  const { showToast } = useToastContext();
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const doc = () => iframeRef.current?.contentDocument ?? null;

  // emptyCharts=true (PERSISTANCE) : on ne garde QUE les donnees (data-spec) du
  // graphique, pas le SVG genere -> message leger, le modele relit des donnees claires.
  // emptyCharts=false (EXPORT PDF/PNG) : on GARDE le SVG genere, car Gotenberg n'execute
  // pas notre renderer ; il imprime le SVG deja present dans le DOM vivant.
  const extractHtml = useCallback((emptyCharts: boolean): string | null => {
    const d = doc();
    if (!d) {
      return null;
    }
    const clone = d.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#ld-style, #ld-script, #ld-chart').forEach((el) => el.remove());
    clone.querySelectorAll('.slide').forEach((s) => (s as HTMLElement).removeAttribute('contenteditable'));
    if (emptyCharts) {
      clone.querySelectorAll('.lancya-chart').forEach((el) => {
        el.innerHTML = '';
      });
    }
    return `<!DOCTYPE html>\n${clone.outerHTML}`;
  }, []);

  const persist = useCallback(() => {
    if (!messageId || !conversationId || partIndex == null) {
      return;
    }
    const html = extractHtml(true);
    if (!html) {
      return;
    }
    const text = '```' + variant.tag + '\n' + html + '\n```';
    void dataService
      .updateMessageContent({ conversationId, messageId, index: partIndex, text })
      .catch(() => undefined);
  }, [messageId, conversationId, partIndex, extractHtml, variant.tag]);

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
    d.querySelectorAll('.slide').forEach((s) => {
      (s as HTMLElement).contentEditable = on ? 'true' : 'false';
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
      a.download = `${variant.file}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* indisponible */
    }
  }, [srcDoc, variant.file]);

  const downloadPdf = useCallback(async () => {
    const clean = extractHtml(false);
    if (!clean) {
      return;
    }
    setPdfLoading(true);
    try {
      const resp = await axios.post(
        '/api/deck/pdf',
        { html: buildPrintHtml(clean, w, h) },
        { responseType: 'arraybuffer' },
      );
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${variant.file}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      showToast?.({ message: "L'export PDF n'est pas disponible pour le moment.", status: 'error' });
    } finally {
      setPdfLoading(false);
    }
  }, [extractHtml, w, h, variant.file, showToast]);

  const downloadImage = useCallback(async () => {
    const clean = extractHtml(false);
    if (!clean) {
      return;
    }
    const list = buildPerSlideHtmls(clean, w, h);
    setImgLoading(true);
    try {
      await downloadImagesFromHtmls(list, w, h, variant.file);
    } catch {
      showToast?.({ message: "L'export en image n'est pas disponible pour le moment.", status: 'error' });
    } finally {
      setImgLoading(false);
    }
  }, [extractHtml, w, h, variant.file, showToast]);

  if (!ready) {
    return (
      <div
        className="not-prose my-3 flex w-full items-center justify-center rounded-2xl border border-border-medium bg-surface-secondary text-sm text-text-secondary shadow-sm"
        style={{ aspectRatio: `${w} / ${h}`, maxHeight: portrait ? '70vh' : undefined }}
      >
        Preparation...
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
        <div className="relative flex justify-center bg-white">
          <iframe
            ref={iframeRef}
            title={variant.title}
            srcDoc={srcDoc}
            onLoad={handleLoad}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block w-full border-0 bg-white"
            style={{ aspectRatio: `${w} / ${h}`, maxHeight: portrait ? '70vh' : undefined }}
          />
          <DeckAnnotate iframeRef={iframeRef} kind={variant.noun} />
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
          <ExportMenu
            icon={<FileDown size={14} />}
            label="PDF"
            loading={pdfLoading}
            multiple={false}
            currentLabel=""
            onAll={downloadPdf}
            onCurrent={downloadPdf}
          />
          <ExportMenu
            icon={<ImageDown size={14} />}
            label="Image"
            loading={imgLoading}
            multiple={false}
            currentLabel=""
            onAll={downloadImage}
            onCurrent={downloadImage}
          />
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
        Changez les couleurs, editez le texte, ou annotez (le crayon) pour demander une modif a l'IA.
      </span>
    </div>
  );
});

export default VisualViewer;
