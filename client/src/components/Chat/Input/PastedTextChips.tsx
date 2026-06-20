import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * PastedTextChips — quand l'utilisateur colle un texte long dans l'input, on n'inonde
 * pas le champ : le texte devient une petite vignette "COLLE" (facon Claude). Un clic
 * ouvre une modale "Contenu colle" ou on peut le RELIRE et le MODIFIER tant qu'on n'a
 * pas envoye. A l'envoi, le contenu est fusionne au message (cf. ChatForm).
 */

export type PastedBlock = { id: string; text: string };

const preview = (t: string) => (t.length > 220 ? t.slice(0, 220) : t);
const sizeKo = (t: string) => {
  try {
    return (new Blob([t]).size / 1024).toFixed(2);
  } catch {
    return (t.length / 1024).toFixed(2);
  }
};

export default function PastedTextChips({
  blocks,
  onChange,
}: {
  blocks: PastedBlock[];
  onChange: (next: PastedBlock[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = blocks.find((b) => b.id === openId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const edit = (id: string, text: string) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, text } : b)));

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {blocks.map((b) => (
        <div key={b.id} className="relative">
          <button
            type="button"
            onClick={() => setOpenId(b.id)}
            className="flex h-[92px] w-[170px] flex-col justify-between rounded-2xl border border-border-medium bg-surface-secondary p-2.5 text-left transition-colors hover:bg-surface-tertiary"
            title="Ouvrir le contenu colle"
          >
            <span className="line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-snug text-text-secondary">
              {preview(b.text)}
            </span>
            <span className="mt-1 inline-block w-fit rounded-md bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-text-secondary">
              COLLE
            </span>
          </button>
          <button
            type="button"
            onClick={() => remove(b.id)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border-medium bg-surface-primary text-text-secondary shadow-sm hover:text-text-primary"
            aria-label="Retirer le contenu colle"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpenId(null)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface-primary shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-border-light px-5 py-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-text-primary">Contenu colle</h3>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {sizeKo(open.text)} Ko · {open.text.split('\n').length} lignes · Le formatage peut
                    etre different de la source
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="shrink-0 rounded-md p-1 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              <textarea
                value={open.text}
                onChange={(e) => edit(open.id, e.target.value)}
                spellCheck={false}
                className="m-4 flex-1 resize-none rounded-xl border border-border-light bg-surface-secondary p-3 font-mono text-sm text-text-primary focus:border-border-heavy focus:outline-none"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
