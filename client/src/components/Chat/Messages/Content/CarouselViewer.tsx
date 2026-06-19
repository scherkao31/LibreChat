import { memo, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Maximize2, Download, FileDown, Pencil, Check } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';

/**
 * CarouselViewer — widget inline pour un CARROUSEL LinkedIn / Instagram (bloc
 * `lancya_carousel`). Meme base que le widget de presentation (SlideDeck) mais au
 * format vertical 4:5 (1080x1350), pensé pour les reseaux et exportable en PDF
 * (un carrousel LinkedIn EST un PDF, une page par carte).
 *
 * Chaque carte est une `<section class="slide">`, palette en variables CSS (:root).
 * On rend dans NOTRE iframe (srcDoc, same-origin) : navigation carte par carte
 * injectee, pickers couleurs, edition contentEditable, persistance des modifs,
 * plein ecran et export PDF/HTML.
 */

// Canevas carrousel 4:5 : 1080x1350. Centre via top/left 50% + marges -H/2,-W/2.
const INJECT_STYLE = `<style id="ld-style">
  html, body { margin: 0; height: 100%; overflow: hidden; }
  .slide { position: absolute !important; top: 50% !important; left: 50% !important; width: 1080px !important; height: 1350px !important; margin: -675px 0 0 -540px !important; transform: scale(var(--ld-scale, 1)); transform-origin: center center; overflow: hidden; box-sizing: border-box; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
  .slide.ld-active { opacity: 1; pointer-events: auto; }
  .ld-nav { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-radius: 999px; background: rgba(127,127,127,.12); backdrop-filter: blur(6px); z-index: 99999; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .ld-btn { border: 0; background: transparent; font-size: 20px; line-height: 1; cursor: pointer; color: var(--text, #1a1a1a); padding: 2px 9px; border-radius: 50%; }
  .ld-btn:hover { background: rgba(127,127,127,.18); }
  .ld-count { font-size: 13px; color: var(--muted, #6b7280); min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; }
  [contenteditable="true"] { outline: none; }
  .slide.ld-active[contenteditable="true"] { cursor: text; }
</style>`;

const INJECT_SCRIPT = `<script id="ld-script">
(function(){
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  if (!slides.length) { return; }
  function fit(){
    var s = Math.min(window.innerWidth / 1080, window.innerHeight / 1350);
    document.documentElement.style.setProperty('--ld-scale', String(s));
  }
  window.addEventListener('resize', fit);
  fit();
  var i = 0, counter = null;
  function show(n){
    i = Math.max(0, Math.min(slides.length - 1, n));
    for (var k = 0; k < slides.length; k++) { slides[k].classList.toggle('ld-active', k === i); }
    if (counter) { counter.textContent = (i + 1) + ' / ' + slides.length; }
  }
  if (slides.length > 1) {
    var bar = document.createElement('div'); bar.className = 'ld-nav';
    var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'ld-btn'; prev.setAttribute('aria-label', 'Carte precedente'); prev.textContent = '\\u2039'; prev.onclick = function(){ show(i - 1); };
    counter = document.createElement('span'); counter.className = 'ld-count';
    var next = document.createElement('button'); next.type = 'button'; next.className = 'ld-btn'; next.setAttribute('aria-label', 'Carte suivante'); next.textContent = '\\u203A'; next.onclick = function(){ show(i + 1); };
    bar.appendChild(prev); bar.appendChild(counter); bar.appendChild(next);
    document.body.appendChild(bar);
    document.addEventListener('keydown', function(e){
      var ae = document.activeElement;
      if (ae && ae.isContentEditable) { return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
    });
  }
  show(0);
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
  let out = html;
  out = out.includes('</head>')
    ? out.replace('</head>', `${INJECT_STYLE}</head>`)
    : `${INJECT_STYLE}${out}`;
  out = out.includes('</body>')
    ? out.replace('</body>', `${INJECT_SCRIPT}</body>`)
    : `${out}${INJECT_SCRIPT}`;
  return out;
}

/** Impression PDF : une carte = une page 1080x1350, marges nulles, sans la nav. */
const PRINT_STYLE = `<style>
  @page { size: 1080px 1350px; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .slide { position: static !important; width: 1080px !important; height: 1350px !important; margin: 0 !important; transform: none !important; opacity: 1 !important; box-sizing: border-box; overflow: hidden; page-break-after: always; break-after: page; }
  .slide:last-child { page-break-after: auto; break-after: auto; }
</style>`;
function buildPrintHtml(cleanHtml: string): string {
  return cleanHtml.includes('</head>')
    ? cleanHtml.replace('</head>', `${PRINT_STYLE}</head>`)
    : `${PRINT_STYLE}${cleanHtml}`;
}

const CarouselViewer = memo(function CarouselViewer({ raw }: { raw: string }) {
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

  const cleanEditedHtml = useCallback((): string | null => {
    const d = doc();
    if (!d) {
      return null;
    }
    const clone = d.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#ld-style, #ld-script, .ld-nav').forEach((el) => el.remove());
    clone.querySelectorAll('.slide').forEach((s) => {
      s.classList.remove('ld-active');
      (s as HTMLElement).removeAttribute('contenteditable');
    });
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
    const text = '```lancya_carousel\n' + html + '\n```';
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
      a.download = 'carrousel.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* indisponible : on ignore */
    }
  }, [srcDoc]);

  // Export PDF au format des cartes (1080x1350 = 11.25 x 14.0625 pouces), sans marge.
  const downloadPdf = useCallback(async () => {
    const clean = cleanEditedHtml();
    if (!clean) {
      return;
    }
    setPdfLoading(true);
    try {
      const resp = await axios.post(
        '/api/deck/pdf',
        { html: buildPrintHtml(clean), paperWidth: '11.25', paperHeight: '14.0625', margin: '0' },
        { responseType: 'arraybuffer' },
      );
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carrousel.pdf';
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
      <div className="not-prose my-3 flex aspect-[4/5] w-full max-w-xs items-center justify-center rounded-2xl border border-border-medium bg-surface-secondary text-sm text-text-secondary shadow-sm">
        Preparation du carrousel...
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
        {/* Format vertical 4:5, largeur limitee pour rester credible en carrousel. */}
        <iframe
          ref={iframeRef}
          title="Carrousel"
          srcDoc={srcDoc}
          onLoad={handleLoad}
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="mx-auto block aspect-[4/5] w-full max-w-[420px] border-0 bg-white"
        />
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
        Naviguez entre les cartes, editez le texte, changez les couleurs. Exportez en PDF pour publier sur LinkedIn.
      </span>
    </div>
  );
});

export default CarouselViewer;
