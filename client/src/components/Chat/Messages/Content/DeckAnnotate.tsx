import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject, MouseEvent } from 'react';
import { Pencil, X, Send } from 'lucide-react';
import { cn } from '~/utils';
import { useSubmitMessage } from '~/hooks';

/**
 * DeckAnnotate — couche d'annotation partagee par les widgets deck (SlideDeck,
 * CarouselViewer, DocViewer). Un crayon flottant active le mode annotation : on
 * clique sur un element du rendu, un repere numerote apparait, et on detecte
 * QUEL element est sous le clic (elementFromPoint sur l'iframe same-origin) pour
 * en capturer une etiquette (son texte). On ajoute une note par repere, puis
 * "Demander a l'IA" envoie un message qui designe precisement ces elements, pour
 * que le modele modifie le bon endroit (il a deja le HTML en historique).
 *
 * A monter DANS le conteneur `relative` qui entoure l'iframe du widget.
 */

type Pin = { id: number; xPct: number; yPct: number; label: string; note: string };

/** Zone lisible a partir des pourcentages (pour designer un endroit, meme vide). */
function zoneOf(xPct: number, yPct: number): string {
  const v = yPct < 33 ? 'en haut' : yPct > 66 ? 'en bas' : 'au milieu';
  const h = xPct < 33 ? 'a gauche' : xPct > 66 ? 'a droite' : 'au centre';
  if (h === 'au centre') {
    return v === 'au milieu' ? 'au centre' : v;
  }
  return `${v}, ${h}`;
}

export default function DeckAnnotate({
  iframeRef,
  kind,
  active: controlledActive,
  onActiveChange,
}: {
  iframeRef: RefObject<HTMLIFrameElement>;
  /** "cette presentation" / "ce carrousel" / "ce document" : injecte dans le message. */
  kind: string;
  /**
   * Mode controle : si onActiveChange est fourni, le declencheur (crayon) est gere par le PARENT
   * (place dans sa barre d'outils) et n'est plus superpose au rendu. Sinon, crayon flottant interne.
   */
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const controlled = onActiveChange != null;
  const [internalActive, setInternalActive] = useState(false);
  const active = controlled ? !!controlledActive : internalActive;
  const setActive = useCallback(
    (next: boolean) => {
      if (controlled) {
        onActiveChange?.(next);
      } else {
        setInternalActive(next);
      }
    },
    [controlled, onActiveChange],
  );
  const [pins, setPins] = useState<Pin[]>([]);

  // Quitter le mode annotation (quel que soit le declencheur) efface les reperes en cours.
  useEffect(() => {
    if (!active) {
      setPins([]);
    }
  }, [active]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const { submitMessage } = useSubmitMessage();

  const handleOverlayClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const overlay = overlayRef.current;
      const d = iframeRef.current?.contentDocument;
      if (!overlay || !d) {
        return;
      }
      const rect = overlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const el = d.elementFromPoint(x, y) as HTMLElement | null;
      let label = '';
      if (el) {
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
        label = text
          ? `« ${text.slice(0, 50)}${text.length > 50 ? '…' : ''} »`
          : `<${el.tagName.toLowerCase()}>`;
      }
      setPins((prev) => [
        ...prev,
        {
          id: nextId.current++,
          xPct: rect.width ? (x / rect.width) * 100 : 0,
          yPct: rect.height ? (y / rect.height) * 100 : 0,
          label,
          note: '',
        },
      ]);
    },
    [iframeRef],
  );

  const setNote = (id: number, note: string) =>
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, note } : p)));
  const removePin = (id: number) => setPins((prev) => prev.filter((p) => p.id !== id));
  const reset = () => {
    setPins([]);
    setActive(false);
  };

  const send = useCallback(() => {
    if (pins.length === 0) {
      setActive(false);
      return;
    }
    const lines = pins
      .map(
        (p, i) =>
          `${i + 1}. (zone : ${zoneOf(p.xPct, p.yPct)})${p.label ? ` element pointe : ${p.label}` : ''}${
            p.note ? ` : ${p.note}` : ''
          }`,
      )
      .join('\n');
    const text = `Modifie ou complete ${kind} ci-dessus selon mes annotations, puis renvoie la version complete mise a jour (le bloc entier). Chaque repere indique une zone et, si pertinent, l'element pointe ; une zone sans element vise = ajouter quelque chose a cet endroit.\n\nAnnotations :\n${lines}`;
    submitMessage({ text });
    reset();
  }, [pins, kind, submitMessage]);

  return (
    <>
      {!controlled && (
        <button
          type="button"
          onClick={() => setActive(!active)}
          title="Annoter pour demander une modif a l'IA"
          className={cn(
            'absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors',
            active
              ? 'border-surface-submit bg-surface-submit text-white'
              : 'border-border-medium bg-surface-primary/90 text-text-secondary hover:text-text-primary',
          )}
        >
          <Pencil size={15} />
        </button>
      )}

      {active && (
        <>
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="absolute inset-0 z-20 cursor-crosshair bg-black/5"
          >
            {pins.map((p, i) => (
              <span
                key={p.id}
                style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                className="absolute -ml-3 -mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-surface-submit text-xs font-bold text-white shadow"
              >
                {i + 1}
              </span>
            ))}
          </div>

          <div className="absolute bottom-2 left-2 right-2 z-30 max-h-[62%] overflow-auto rounded-xl border border-border-medium bg-surface-primary p-2.5 shadow-md">
            {pins.length === 0 ? (
              <div className="px-1 py-1.5 text-xs text-text-secondary">
                Cliquez sur un element pour le modifier, ou sur une zone vide pour y ajouter
                quelque chose, puis ecrivez ce que vous voulez.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pins.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-submit text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <input
                      value={p.note}
                      onChange={(e) => setNote(p.id, e.target.value)}
                      placeholder={p.label || 'Que changer ou ajouter ici ?'}
                      className="min-w-0 flex-1 rounded-md border border-border-light bg-surface-secondary px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removePin(p.id)}
                      className="shrink-0 text-text-secondary hover:text-text-primary"
                      aria-label="Retirer ce repere"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={send}
                disabled={pins.length === 0}
                className={cn(
                  'flex items-center gap-1.5 rounded-md bg-surface-submit px-3 py-1 text-xs font-medium text-white',
                  pins.length === 0 && 'cursor-not-allowed opacity-40',
                )}
              >
                <Send size={13} />
                Demander a l'IA
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
