import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useSubmitMessage } from '~/hooks';

/**
 * RefineSelection — interaction "affiner en selectionnant". Quand l'utilisateur
 * surligne un passage du texte d'une reponse de l'IA, une barre flottante apparait
 * au-dessus de la selection. Deux usages :
 *  - ACTION IMMEDIATE : un clic (Raccourcir / Reformuler / ...) envoie tout de suite un
 *    message cible qui cite ce passage (via useSubmitMessage) ;
 *  - ACCUMULATION : "Noter" permet d'ajouter le passage + un avis a une LISTE. On
 *    repete sur plusieurs passages, puis "Demander a l'IA" envoie tout d'un coup.
 * Dans tous les cas, le message part dans la MEME conversation : l'IA garde tout le
 * contexte (sa reponse entiere), le passage cite sert juste d'ancre.
 *
 * Monte dans le conteneur de texte d'un message ASSISTANT (containerRef).
 */

type Pop = { cx: number; top: number; bottom: number; text: string };
type Note = { id: number; text: string; note: string };

// Actions rapides. "Expliquer" est une QUESTION (en savoir plus), pas une reecriture ;
// les autres sont des retouches explicites. Pour tout le reste, "+ Noter" laisse l'avis
// ou la question libre.
const ACTIONS: { key: string; label: string; build: (t: string) => string }[] = [
  {
    key: 'explain',
    label: 'Expliquer',
    build: (t) => `Peux-tu m'en dire plus sur ce passage de ta reponse et l'expliquer davantage : « ${t} » ?`,
  },
  {
    key: 'rephrase',
    label: 'Reformuler',
    build: (t) => `Reformule ce passage de ta reponse autrement, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'short',
    label: 'Raccourcir',
    build: (t) => `Raccourcis ce passage de ta reponse en gardant l'essentiel, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'simple',
    label: 'Plus simple',
    build: (t) => `Reecris ce passage de ta reponse en plus simple et plus clair, puis donne la version reecrite : « ${t} »`,
  },
  {
    key: 'formal',
    label: 'Plus formel',
    build: (t) => `Reecris ce passage de ta reponse sur un ton plus formel, puis donne la version reecrite : « ${t} »`,
  },
];

const snippet = (t: string) => (t.length > 60 ? t.slice(0, 60) + '…' : t);

function buildBatch(batch: Note[], global: string): string {
  const lines = batch
    .map((b, i) => `${i + 1}. « ${b.text} »${b.note ? ` : ${b.note}` : ''}`)
    .join('\n');
  const g = global.trim();
  // Formulation NEUTRE : selon ma remarque/question, l'IA corrige, precise, ou repond.
  // On n'impose pas "version corrigee".
  const head = g
    ? `Voici plusieurs passages de ta reponse. ${g}`
    : `Voici plusieurs passages de ta reponse, chacun avec ma remarque ou ma question. Reponds a chacun comme il convient (corriger, preciser, repondre, developper selon le cas).`;
  return `${head}\n\n${lines}`;
}

export default function RefineSelection({ containerRef }: { containerRef: RefObject<HTMLElement> }) {
  const [pop, setPop] = useState<Pop | null>(null);
  const [noting, setNoting] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [batch, setBatch] = useState<Note[]>([]);
  const [global, setGlobal] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
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
      setNoting(false);
      setNoteText('');
      setPop({ cx: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom, text });
    };
    el.addEventListener('mouseup', onUp);
    return () => el.removeEventListener('mouseup', onUp);
  }, [containerRef]);

  // Fermer la barre : clic hors barre, scroll.
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

  const clearSel = () => window.getSelection()?.removeAllRanges();

  const sendNow = useCallback(
    (text: string) => {
      submitMessage({ text });
      clearSel();
      setPop(null);
    },
    [submitMessage],
  );

  const addToBatch = useCallback(() => {
    if (!pop) {
      return;
    }
    setBatch((prev) => [...prev, { id: nextId.current++, text: pop.text, note: noteText.trim() }]);
    clearSel();
    setPop(null);
  }, [pop, noteText]);

  const removeNote = (id: number) => setBatch((prev) => prev.filter((b) => b.id !== id));

  const sendBatch = useCallback(() => {
    if (!batch.length) {
      return;
    }
    submitMessage({ text: buildBatch(batch, global) });
    setBatch([]);
    setGlobal('');
  }, [batch, global, submitMessage]);

  const below = pop ? pop.top < 64 : false;

  return (
    <>
      {/* Liste cumulative (mes remarques sur ce message) : not-prose pour exclure les
          selections faites a l'interieur de la liste elle-meme. */}
      {batch.length > 0 && (
        <div className="not-prose my-2 rounded-xl border border-border-medium bg-surface-secondary p-2.5 text-sm">
          <div className="mb-1.5 px-1 text-xs font-medium text-text-secondary">
            Mes remarques ({batch.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {batch.map((b, i) => (
              <div key={b.id} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-submit text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs italic text-text-secondary">« {snippet(b.text)} »</div>
                  {b.note && <div className="text-xs text-text-primary">{b.note}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => removeNote(b.id)}
                  className="shrink-0 text-text-secondary hover:text-text-primary"
                  aria-label="Retirer"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <input
            value={global}
            onChange={(e) => setGlobal(e.target.value)}
            placeholder="Remarque ou question d'ensemble (optionnel)"
            className="mt-2 w-full rounded-lg border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setBatch([]);
                setGlobal('');
              }}
              className="rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Tout effacer
            </button>
            <button
              type="button"
              onClick={sendBatch}
              className="rounded-md bg-surface-submit px-3 py-1 text-xs font-medium text-white"
            >
              Demander a l'IA
            </button>
          </div>
        </div>
      )}

      {/* Barre flottante au-dessus de la selection. */}
      {pop &&
        createPortal(
          <div
            ref={barRef}
            className={`fixed z-[60] -translate-x-1/2 ${below ? '' : '-translate-y-full'}`}
            style={below ? { left: pop.cx, top: pop.bottom + 8 } : { left: pop.cx, top: pop.top - 8 }}
          >
            <div className="flex items-center gap-0.5 rounded-xl border border-border-medium bg-surface-primary p-1 shadow-lg">
              {!noting ? (
                <>
                  {ACTIONS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => sendNow(a.build(pop.text))}
                      className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                    >
                      {a.label}
                    </button>
                  ))}
                  <span className="mx-0.5 h-4 w-px bg-border-medium" />
                  <button
                    type="button"
                    onClick={() => setNoting(true)}
                    className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
                  >
                    + Noter
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addToBatch();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ta remarque ou ta question"
                    className="w-52 rounded-lg border border-border-light bg-surface-secondary px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-lg bg-surface-submit px-2.5 py-1 text-xs font-medium text-white"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendNow(
                        noteText.trim()
                          ? `Concernant ce passage de ta reponse : « ${pop.text} », ${noteText.trim()}`
                          : `A propos de ce passage de ta reponse : « ${pop.text} »`,
                      )
                    }
                    className="whitespace-nowrap rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                    title="Envoyer seulement ce passage maintenant"
                  >
                    Envoyer
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
