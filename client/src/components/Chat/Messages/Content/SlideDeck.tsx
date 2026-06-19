import { memo, useMemo, useRef, useCallback } from 'react';
import { Maximize2, Download } from 'lucide-react';
import { cn } from '~/utils';

/**
 * SlideDeck — widget inline pour les presentations HTML (bloc `lancya_deck`).
 *
 * Le modele emet un bloc de code fence `lancya_deck` contenant le HTML COMPLET et
 * autonome d'un deck (cf. skill presentation-html). Convention attendue : chaque
 * diapo est une `<section class="slide">`, la palette est en variables CSS (:root).
 *
 * On rend ce HTML dans NOTRE PROPRE iframe (srcDoc) au milieu de la conversation,
 * pas dans le panneau Artefacts. On y injecte :
 *  - un style qui empile les `.slide` plein cadre (une visible a la fois) ;
 *  - un script qui gere la navigation (boutons + fleches + compteur), DANS l'iframe
 *    pour que ca marche aussi en plein ecran.
 * Si le HTML ne suit pas la convention (aucune `.slide`), il s'affiche tel quel
 * (repli gracieux), sans navigation.
 *
 * Phase 1 : rendu + navigation + plein ecran + telechargement. L'edition (couleurs,
 * texte) viendra ensuite, en exploitant le meme iframe.
 *
 * Branche dans le composant `code` du chat. Rien ne s'affiche tant que le HTML n'est
 * pas complet (robuste au streaming).
 */

const INJECT_STYLE = `<style>
  html, body { margin: 0; height: 100%; }
  .slide { position: absolute !important; inset: 0 !important; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
  .slide.ld-active { opacity: 1; pointer-events: auto; }
  .ld-nav { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-radius: 999px; background: rgba(127,127,127,.12); backdrop-filter: blur(6px); z-index: 99999; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .ld-btn { border: 0; background: transparent; font-size: 20px; line-height: 1; cursor: pointer; color: var(--text, #1a1a1a); padding: 2px 9px; border-radius: 50%; }
  .ld-btn:hover { background: rgba(127,127,127,.18); }
  .ld-count { font-size: 13px; color: var(--muted, #6b7280); min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; }
</style>`;

const INJECT_SCRIPT = `<script>
(function(){
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  if (!slides.length) { return; }
  var i = 0, counter = null;
  function show(n){
    i = Math.max(0, Math.min(slides.length - 1, n));
    for (var k = 0; k < slides.length; k++) { slides[k].classList.toggle('ld-active', k === i); }
    if (counter) { counter.textContent = (i + 1) + ' / ' + slides.length; }
  }
  if (slides.length > 1) {
    var bar = document.createElement('div'); bar.className = 'ld-nav';
    var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'ld-btn'; prev.setAttribute('aria-label', 'Diapositive precedente'); prev.textContent = '\\u2039'; prev.onclick = function(){ show(i - 1); };
    counter = document.createElement('span'); counter.className = 'ld-count';
    var next = document.createElement('button'); next.type = 'button'; next.className = 'ld-btn'; next.setAttribute('aria-label', 'Diapositive suivante'); next.textContent = '\\u203A'; next.onclick = function(){ show(i + 1); };
    bar.appendChild(prev); bar.appendChild(counter); bar.appendChild(next);
    document.body.appendChild(bar);
    document.addEventListener('keydown', function(e){
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); show(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(i - 1); }
    });
  }
  show(0);
})();
</script>`;

function looksComplete(raw: string): boolean {
  const t = raw.toLowerCase();
  return t.includes('</body>') || t.includes('</html>');
}

function buildSrcDoc(html: string): string {
  let out = html;
  out = out.includes('</head>') ? out.replace('</head>', `${INJECT_STYLE}</head>`) : `${INJECT_STYLE}${out}`;
  out = out.includes('</body>') ? out.replace('</body>', `${INJECT_SCRIPT}</body>`) : `${out}${INJECT_SCRIPT}`;
  return out;
}

const SlideDeck = memo(function SlideDeck({ raw }: { raw: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ready = looksComplete(raw);
  const srcDoc = useMemo(() => (ready ? buildSrcDoc(raw) : ''), [ready, raw]);

  const goFullscreen = useCallback(() => {
    iframeRef.current?.requestFullscreen?.();
  }, []);

  const download = useCallback(() => {
    try {
      // On exporte la version AVEC la navigation injectee, pour que le fichier
      // telecharge se presente seul (une slide a la fois + boutons + fleches).
      const blob = new Blob([srcDoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'presentation.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* indisponible : on ignore */
    }
  }, [srcDoc]);

  if (!ready) {
    return (
      <div className="not-prose my-3 flex aspect-video w-full items-center justify-center rounded-2xl border border-border-medium bg-surface-secondary text-sm text-text-secondary shadow-sm">
        Preparation de la presentation...
      </div>
    );
  }

  return (
    <div className="not-prose my-3 w-full font-sans">
      <div className="overflow-hidden rounded-2xl border border-border-medium bg-surface-secondary shadow-sm">
        <iframe
          ref={iframeRef}
          title="Presentation"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="block aspect-video w-full border-0 bg-white"
        />
        <div className="flex items-center justify-end gap-2 border-t border-border-light px-3 py-2">
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
            Telecharger
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
        Naviguez avec les fleches ou les boutons. Plein ecran pour presenter.
      </span>
    </div>
  );
});

export default SlideDeck;
