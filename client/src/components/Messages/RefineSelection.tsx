import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useSubmitMessage } from '~/hooks';

/**
 * RefineSelection — interaction "affiner en selectionnant". Quand l'utilisateur
 * surligne un passage du texte d'une reponse de l'IA, une petite barre flottante
 * apparait au-dessus de la selection (raccourcir / developper / reformuler / ton /
 * autre). Un clic envoie un message cible qui cite ce passage, via useSubmitMessage :
 * l'IA repond avec la version retravaillee. C'est le pendant "texte" du crayon
 * d'annotation des widgets.
 *
 * Monte dans le conteneur de texte d'un message ASSISTANT (containerRef). La barre
 * est rendue via un portail (position: fixed) pour ne pas etre rognee par la bulle.
 */

type Pop = { cx: number; top: number; bottom: number; text: string };

const ACTIONS: { key: string; label: string; build: (t: string) => string }[] = [
  {
    key: 'short',
    label: 'Raccourcir',
    build: (t) => `Raccourcis ce passage de ta reponse en gardant l'essentiel, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'expand',
    label: 'Developper',
    build: (t) => `Developpe ce passage de ta reponse avec plus de detail, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'rephrase',
    label: 'Reformuler',
    build: (t) => `Reformule ce passage de ta reponse autrement, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'formal',
    label: 'Plus formel',
    build: (t) => `Reecris ce passage de ta reponse sur un ton plus formel, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'simple',
    label: 'Plus simple',
    build: (t) => `Reecris ce passage de ta reponse en plus simple et plus clair, puis donne la version reecrite : « ${t} »`,
  },
];

export default function RefineSelection({ containerRef }: { containerRef: RefObject<HTMLElement> }) {
  const [pop, setPop] = useState<Pop | null>(null);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const { submitMessage } = useSubmitMessage();

  // Detecte une selection de texte DANS ce message (hors blocs de code et widgets).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) {
        return;
      }
      let anc: Node | null = range.commonAncestorContainer;
      while (anc && anc !== el) {
        if (
          anc instanceof HTMLElement &&
          (anc.tagName === 'PRE' || anc.tagName === 'CODE' || anc.classList.contains('not-prose'))
        ) {
          return;
        }
        anc = anc.parentNode;
      }
      const text = sel.toString().trim();
      if (text.length < 2) {
        return;
      }
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        return;
      }
      setCustom(false);
      setCustomText('');
      setPop({ cx: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, text });
    };
    el.addEventListener('mouseup', onUp);
    return () => el.removeEventListener('mouseup', onUp);
  }, [containerRef]);

  // Fermer : clic hors barre, scroll.
  useEffect(() => {
    if (!pop) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (barRef.current && barRef.current.contains(e.target as Node)) {
        return;
      }
      setPop(null);
    };
    const onScroll = () => setPop(null);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [pop]);

  const send = useCallback(
    (text: string) => {
      submitMessage({ text });
      window.getSelection()?.removeAllRanges();
      setPop(null);
    },
    [submitMessage],
  );

  if (!pop) {
    return null;
  }

  const below = pop.top < 64;
  const style = below
    ? { left: pop.cx, top: pop.bottom + 8 }
    : { left: pop.cx, top: pop.top - 8 };

  return createPortal(
    <div
      ref={barRef}
      className={`fixed z-[60] -translate-x-1/2 ${below ? '' : '-translate-y-full'}`}
      style={style}
    >
      <div className="flex items-center gap-0.5 rounded-xl border border-border-medium bg-surface-primary p-1 shadow-lg">
        {!custom ? (
          <>
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => send(a.build(pop.text))}
                className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="whitespace-nowrap rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            >
              Autre…
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = customText.trim();
              if (t) {
                send(`Concernant ce passage de ta reponse : « ${pop.text} », ${t}`);
              }
            }}
            className="flex items-center gap-1"
          >
            <input
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Que faire de ce passage ?"
              className="w-56 rounded-lg border border-border-light bg-surface-secondary px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
            />
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-surface-submit px-2.5 py-1 text-xs font-medium text-white"
            >
              Envoyer
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
