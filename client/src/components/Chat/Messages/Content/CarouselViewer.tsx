import { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Maximize2,
  Download,
  FileDown,
  Pencil,
  Check,
  Copy,
  User,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ThumbsUp,
  Repeat2,
  ImageDown,
  Wand2,
} from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import { useMessageContext } from '~/Providers';
import { cn } from '~/utils';
import { buildPerSlideHtmls, filterToSlideHtml, downloadImagesFromHtmls } from '~/utils/deckImages';
import ExportMenu from '~/components/Chat/Messages/Content/ExportMenu';
import DeckAnnotate from '~/components/Chat/Messages/Content/DeckAnnotate';
import { useActiveDeckSlide } from '~/components/Chat/Messages/Content/useActiveDeckSlide';

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
  .ld-counter { position: fixed; top: 12px; right: 12px; background: rgba(0,0,0,.7); color: #fff; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 999px; z-index: 99999; font-variant-numeric: tabular-nums; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .ld-arrow { position: fixed; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.95); border: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 99999; box-shadow: 0 1px 6px rgba(0,0,0,.28); opacity: 0; transition: opacity .18s; }
  body:hover .ld-arrow { opacity: 1; }
  .ld-arrow[disabled] { opacity: 0 !important; pointer-events: none; }
  .ld-arrow.prev { left: 10px; } .ld-arrow.next { right: 10px; }
  .ld-arrow svg { width: 18px; height: 18px; fill: none; stroke: #222; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
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
  var i = 0, counter = null, prev = null, next = null;
  function show(n){
    i = Math.max(0, Math.min(slides.length - 1, n));
    for (var k = 0; k < slides.length; k++) { slides[k].classList.toggle('ld-active', k === i); }
    if (counter) { counter.textContent = (i + 1) + ' / ' + slides.length; }
    if (prev) { prev.disabled = (i === 0); }
    if (next) { next.disabled = (i === slides.length - 1); }
    try { parent.postMessage({ lancyaDeckSlide: true, index: i, count: slides.length }, '*'); } catch (e) {}
  }
  if (slides.length > 1) {
    counter = document.createElement('div'); counter.className = 'ld-counter'; document.body.appendChild(counter);
    prev = document.createElement('button'); prev.type = 'button'; prev.className = 'ld-arrow prev'; prev.setAttribute('aria-label', 'Carte precedente'); prev.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'; prev.onclick = function(){ show(i - 1); };
    next = document.createElement('button'); next.type = 'button'; next.className = 'ld-arrow next'; next.setAttribute('aria-label', 'Carte suivante'); next.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'; next.onclick = function(){ show(i + 1); };
    document.body.appendChild(prev); document.body.appendChild(next);
    document.addEventListener('keydown', function(e){
      var ae = document.activeElement;
      if (ae && ae.isContentEditable) { return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
    });
    window.addEventListener('message', function(e){
      var d = e.data; if (d && d.lancyaDeckGo) { show(d.index | 0); }
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

/**
 * Legende suggeree par le modele, via <meta name="lancya-caption" content="...">.
 * Le content contient des apostrophes (francais : c'est, qu'un, l'humanite...) : on
 * capture le guillemet ouvrant puis on matche jusqu'au MEME guillemet (backreference),
 * sinon `[^"']*` couperait la legende a la premiere apostrophe.
 */
function parseCaption(raw: string): string {
  const m = /<meta\s+name=["']lancya-caption["']\s+content=(["'])([\s\S]*?)\1/i.exec(raw);
  if (!m) {
    return '';
  }
  return m[2]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
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

/**
 * Petit champ inline pour un chiffre d'engagement de l'apercu (j'aime, commentaires...) : on clique,
 * on change la valeur. Controle (pas de saut de curseur), il herite de la typo environnante et se
 * dimensionne au contenu. Purement cosmetique, jamais exporte dans le carrousel.
 */
function StatInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Modifier la valeur"
      className="rounded border-0 bg-transparent px-0.5 py-0 text-center align-baseline text-inherit outline-none transition-colors hover:bg-black/[0.06] focus:bg-black/[0.06]"
      style={{ width: `${Math.max(1, value.length)}ch`, font: 'inherit' }}
    />
  );
}

const CarouselViewer = memo(function CarouselViewer({ raw }: { raw: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { index: currentIndex, count: slideCount } = useActiveDeckSlide(iframeRef);
  const ready = looksComplete(raw);
  const srcDoc = useMemo(() => (ready ? buildSrcDoc(raw) : ''), [ready, raw]);

  const palette = useMemo(() => parseRootColors(raw), [raw]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [platform, setPlatform] = useState<'instagram' | 'linkedin'>('instagram');
  const [caption, setCaption] = useState('');
  const [captionCopied, setCaptionCopied] = useState(false);
  // Chiffres d'engagement de l'apercu : cosmetiques, editables d'un clic pour une capture credible
  // (ils ne font PAS partie du carrousel exporte, c'est juste le contour facon post).
  const [reactions, setReactions] = useState('138');
  const [comments, setComments] = useState('24');
  const [likes, setLikes] = useState('1 248');
  // Mode "retoucher avec l'IA" (pointer un element pour demander une modif). Son declencheur vit
  // dans la barre d'outils du bas ; la couche d'annotation (DeckAnnotate) ne s'affiche que si actif.
  const [annotating, setAnnotating] = useState(false);
  const seededRef = useRef(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);
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
    clone
      .querySelectorAll('#ld-style, #ld-script, .ld-nav, .ld-counter, .ld-arrow')
      .forEach((el) => el.remove());
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
  const downloadPdf = useCallback(
    async (scope: 'all' | 'current') => {
      const clean = cleanEditedHtml();
      if (!clean) {
        return;
      }
      const html = scope === 'current' ? filterToSlideHtml(clean, currentIndex) : clean;
      setPdfLoading(true);
      try {
        const resp = await axios.post(
          '/api/deck/pdf',
          { html: buildPrintHtml(html), paperWidth: '11.25', paperHeight: '14.0625', margin: '0' },
          { responseType: 'arraybuffer' },
        );
        const blob = new Blob([resp.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = scope === 'current' ? 'carte.pdf' : 'carrousel.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        showToast?.({ message: "L'export PDF n'est pas disponible pour le moment.", status: 'error' });
      } finally {
        setPdfLoading(false);
      }
    },
    [cleanEditedHtml, currentIndex, showToast],
  );

  // Pre-remplit la legende une fois (quand le carrousel est complet), sans ecraser
  // les retouches de l'utilisateur ensuite.
  useEffect(() => {
    if (ready && !seededRef.current) {
      setCaption(parseCaption(raw));
      seededRef.current = true;
    }
  }, [ready, raw]);

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 1500);
    } catch {
      /* presse-papier indisponible */
    }
  }, [caption]);

  // Les points (chrome React) pilotent l'iframe : on pousse l'index, le script injecte ecoute
  // `lancyaDeckGo`. Les fleches et le clavier restent DANS l'iframe (donc dispo en plein ecran).
  const goToSlide = useCallback((n: number) => {
    iframeRef.current?.contentWindow?.postMessage({ lancyaDeckGo: true, index: n }, '*');
  }, []);

  // La legende s'edite en place (facon texte de post) : on cale la hauteur sur le contenu.
  useEffect(() => {
    const el = captionRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [caption, platform, ready]);

  // Export PNG par carte (1080x1350) : la carte courante (PNG) ou toutes (ZIP).
  const downloadImages = useCallback(
    async (scope: 'all' | 'current') => {
      const clean = cleanEditedHtml();
      if (!clean) {
        return;
      }
      const all = buildPerSlideHtmls(clean, 1080, 1350);
      const list = scope === 'current' ? all.slice(currentIndex, currentIndex + 1) : all;
      setImgLoading(true);
      try {
        await downloadImagesFromHtmls(list, 1080, 1350, scope === 'current' ? 'carte' : 'carrousel-images');
      } catch {
        showToast?.({ message: "L'export en images n'est pas disponible pour le moment.", status: 'error' });
      } finally {
        setImgLoading(false);
      }
    },
    [cleanEditedHtml, currentIndex, showToast],
  );

  if (!ready) {
    return (
      <div className="not-prose my-3 flex aspect-[4/5] w-full max-w-xs items-center justify-center rounded-2xl border border-border-medium bg-surface-secondary text-sm text-text-secondary shadow-sm">
        Preparation du carrousel...
      </div>
    );
  }

  const colorValue = (e: PaletteEntry) => overrides[e.name] ?? e.value;
  // Avatar colore comme l'accent du carrousel + fond d'iframe assorti (evite un lisere si le slide
  // ne remplit pas pile l'iframe), comme dans le rendu du skill.
  const accentColor = overrides.accent ?? palette.find((e) => e.name === 'accent')?.value ?? '#16243F';
  const bgColor = overrides.bg ?? palette.find((e) => e.name === 'bg')?.value ?? '#FBF7EF';

  return (
    <div className="not-prose my-3 flex w-full flex-col items-center font-sans">
      {/* Toggle d'apercu : Instagram / LinkedIn (cosmetique). */}
      <div className="mb-2 flex items-center gap-0.5 rounded-full border border-border-light bg-surface-tertiary p-0.5 text-xs">
        {(['instagram', 'linkedin'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={cn(
              'rounded-full px-3 py-1 transition-colors',
              platform === p
                ? 'bg-surface-primary font-medium text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {p === 'instagram' ? 'Instagram' : 'LinkedIn'}
          </button>
        ))}
      </div>

      {/* Carte facon post reel. Le carrousel (iframe) ne change pas ; on soigne le contour. */}
      <div
        className={cn(
          'w-full max-w-[400px] overflow-hidden rounded-xl border bg-white text-[#000000e6] shadow-sm',
          editing ? 'border-border-heavy ring-2 ring-border-heavy' : 'border-border-medium',
        )}
      >
        {/* En-tete (specifique a la plateforme) */}
        {platform === 'linkedin' ? (
          <div className="flex items-start gap-2 px-3.5 pb-2 pt-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              <User size={20} />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">Votre nom</div>
              <div className="truncate text-xs text-[#00000099]">Votre accroche de profil</div>
              <div className="text-xs text-[#00000099]">18 h</div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[#0a66c2]">+ Suivre</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1 text-sm font-semibold">votre_compte</div>
            <MoreHorizontal size={18} className="shrink-0" />
          </div>
        )}

        {/* LinkedIn : la legende est le texte du post, au-dessus du carrousel. */}
        {platform === 'linkedin' && (
          <textarea
            ref={captionRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={1}
            placeholder="Ecrivez votre legende..."
            className="block w-full resize-none border-0 bg-transparent px-3.5 pb-2.5 text-sm leading-snug text-[#000000e6] placeholder:text-[#00000066] focus:outline-none focus:ring-0"
          />
        )}

        {/* Carrousel : iframe PARTAGEE entre les deux apercus (pas de rechargement au toggle). */}
        <div className="relative">
          <iframe
            ref={iframeRef}
            title="Carrousel"
            srcDoc={srcDoc}
            onLoad={handleLoad}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block aspect-[4/5] w-full border-0"
            style={{ backgroundColor: bgColor }}
          />
          <DeckAnnotate
            iframeRef={iframeRef}
            kind="ce carrousel"
            active={annotating}
            onActiveChange={setAnnotating}
          />
          {platform === 'instagram' && slideCount > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {Array.from({ length: slideCount }).map((_, n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Carte ${n + 1}`}
                  onClick={() => goToSlide(n)}
                  className="pointer-events-auto h-1.5 w-1.5 rounded-full transition-all"
                  style={{ backgroundColor: n === currentIndex ? '#0095f6' : 'rgba(0,0,0,.2)' }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bas de carte (specifique a la plateforme) */}
        {platform === 'linkedin' ? (
          <>
            {slideCount > 1 && (
              <div className="flex justify-center gap-1.5 py-2.5">
                {Array.from({ length: slideCount }).map((_, n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Carte ${n + 1}`}
                    onClick={() => goToSlide(n)}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: n === currentIndex ? 20 : 6,
                      backgroundColor: n === currentIndex ? '#0a66c2' : '#c9ccd1',
                    }}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3.5 pb-2.5 pt-1 text-xs text-[#00000099]">
              <ThumbsUp size={14} className="text-[#0a66c2]" />
              <span>
                Vous et <StatInput value={reactions} onChange={setReactions} /> autres
              </span>
              <span className="ml-auto">
                <StatInput value={comments} onChange={setComments} /> commentaires
              </span>
            </div>
            <div className="mx-3 border-t border-[#e9e9e7]" />
            <div className="flex items-center justify-around px-1.5 py-1 text-[#00000099]">
              <span className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-medium">
                <ThumbsUp size={18} /> J'aime
              </span>
              <span className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-medium">
                <MessageCircle size={18} /> Commenter
              </span>
              <span className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-medium">
                <Repeat2 size={18} /> Republier
              </span>
              <span className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-medium">
                <Send size={18} /> Envoyer
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 px-3.5 pb-1 pt-2.5 text-[#000000e6]">
              <Heart size={24} />
              <MessageCircle size={24} />
              <Send size={24} />
              <Bookmark size={24} className="ml-auto" />
            </div>
            <div className="px-3.5 pb-0.5 text-sm font-semibold">
              <StatInput value={likes} onChange={setLikes} /> j'aime
            </div>
            <div className="flex items-baseline gap-1.5 px-3.5 pb-1">
              <span className="shrink-0 text-sm font-semibold">votre_compte</span>
              <textarea
                ref={captionRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={1}
                placeholder="Ecrivez votre legende..."
                className="block flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-snug text-[#000000e6] placeholder:text-[#00000066] focus:outline-none focus:ring-0"
              />
            </div>
            <div className="px-3.5 pb-3 pt-1 text-[10px] uppercase tracking-wide text-[#00000099]">
              Il y a 18 heures
            </div>
          </>
        )}
      </div>

      {/* Outils : couleurs + edition + export. */}
      <div className="mt-2 flex w-full max-w-[400px] flex-wrap items-center gap-x-3 gap-y-2">
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
          onClick={() => setAnnotating((a) => !a)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
            annotating
              ? 'bg-surface-tertiary text-text-primary'
              : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary',
            'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
          )}
        >
          <Wand2 size={14} />
          {annotating ? 'Terminer' : "Retoucher avec l'IA"}
        </button>
        <button
          type="button"
          onClick={copyCaption}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
            'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
          )}
        >
          {captionCopied ? <Check size={14} /> : <Copy size={14} />}
          {captionCopied ? 'Legende copiee' : 'Copier la legende'}
        </button>
        <ExportMenu
          icon={<FileDown size={14} />}
          label="PDF"
          loading={pdfLoading}
          multiple={slideCount > 1}
          currentLabel="Cette carte"
          onAll={() => downloadPdf('all')}
          onCurrent={() => downloadPdf('current')}
        />
        <ExportMenu
          icon={<ImageDown size={14} />}
          label="Images"
          loading={imgLoading}
          multiple={slideCount > 1}
          currentLabel="Cette carte"
          onAll={() => downloadImages('all')}
          onCurrent={() => downloadImages('current')}
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

      <span className="mt-1 block w-full max-w-[400px] px-1 text-xs text-text-secondary">
        Apercu facon post. Editez le texte des cartes, ajustez la legende, exportez en PDF (carrousel LinkedIn) ou HTML.
      </span>
    </div>
  );
});

export default CarouselViewer;
