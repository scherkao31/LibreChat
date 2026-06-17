import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, ArrowRight } from 'lucide-react';
import { cn } from '~/utils';
import { useMessageContext } from '~/Providers';
import { useSubmitMessage } from '~/hooks';

/**
 * SuggestedVariants — widget de "variantes" (plusieurs versions d'un meme texte,
 * typiquement des emails) presentees en onglets, avec copie et choix.
 *
 * Le modele emet un bloc de code fence dont le langage est `lancya_variants`. Comme
 * les corps d'email sont LONGS et MULTI-LIGNES, on n'utilise PAS de JSON (un retour
 * a la ligne reel dans une chaine JSON est invalide, et les modeles se trompent
 * souvent la-dessus). On utilise un format a delimiteurs, robuste a tout texte :
 *
 *   ```lancya_variants
 *   [[ Courte et directe ]]
 *   Objet : Relance facture
 *
 *   Bonjour,
 *   ...
 *
 *   [[ Cordiale ]]
 *   Objet : ...
 *   ...
 *   ```
 *
 * Chaque section `[[ Libelle ]]` devient un onglet. Sous la variante active :
 *  - "Copier" : copie le corps dans le presse-papier ;
 *  - "Continuer avec celle-ci" : envoie un message indiquant le choix, pour que le
 *    modele poursuive (affiner, envoyer, etc.).
 *
 * Branche UNIQUEMENT dans le composant `code` du chat, donc les contextes chat
 * sont toujours presents. Rien ne s'affiche tant qu'aucune section complete n'est
 * parsee (robuste au streaming).
 */

type Variant = { label: string; body: string };

const SECTION_RE = /^\[\[\s*(.+?)\s*\]\]\s*$/;

function parseVariants(raw: string): Variant[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const variants: Variant[] = [];
  let current: { label: string; body: string[] } | null = null;

  for (const line of lines) {
    const match = SECTION_RE.exec(line.trim());
    if (match) {
      if (current) {
        variants.push({ label: current.label, body: current.body.join('\n').trim() });
      }
      current = { label: match[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) {
    variants.push({ label: current.label, body: current.body.join('\n').trim() });
  }

  // On ne garde que les variantes qui ont deja un corps (evite un onglet vide
  // pendant que le streaming est encore sur le libelle).
  return variants.filter((v) => v.label && v.body);
}

const SuggestedVariants = memo(function SuggestedVariants({ raw }: { raw: string }) {
  const variants = useMemo(() => parseVariants(raw), [raw]);
  const { isSubmitting = false } = useMessageContext();
  const { submitMessage } = useSubmitMessage();
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papier indisponible : on ignore silencieusement */
    }
  }, []);

  const handleChoose = useCallback(
    (label: string) => {
      if (isSubmitting) {
        return;
      }
      submitMessage({ text: `Je retiens la version "${label}".` });
    },
    [isSubmitting, submitMessage],
  );

  if (variants.length === 0) {
    return null;
  }

  const activeIdx = Math.min(active, variants.length - 1);
  const activeVariant = variants[activeIdx];

  return (
    <div className="not-prose mt-3 w-full font-sans">
      {/* Onglets */}
      <div className="flex flex-wrap gap-1.5">
        {variants.map((variant, idx) => (
          <button
            key={`variant-tab-${idx}-${variant.label}`}
            type="button"
            onClick={() => {
              setActive(idx);
              setCopied(false);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
              idx === activeIdx
                ? 'border-transparent bg-text-primary text-surface-primary'
                : 'border-border-medium bg-surface-secondary text-text-secondary hover:bg-surface-tertiary',
            )}
          >
            {variant.label}
          </button>
        ))}
      </div>

      {/* Corps de la variante active */}
      <div className="mt-2 rounded-2xl border border-border-medium bg-surface-secondary">
        <div className="whitespace-pre-wrap px-4 py-3 text-sm text-text-primary">
          {activeVariant.body}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border-light px-3 py-2">
          <button
            type="button"
            onClick={() => handleCopy(activeVariant.body)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
              'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            )}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copie' : 'Copier'}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleChoose(activeVariant.label)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg bg-surface-submit px-3 py-1.5 text-xs font-medium text-white',
              'transition-colors duration-150 hover:bg-surface-submit-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
              isSubmitting && 'cursor-not-allowed opacity-40',
            )}
          >
            Continuer avec celle-ci
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <span className="mt-1 block px-1 text-xs text-text-secondary">
        ou ecris directement ce que tu veux ajuster.
      </span>
    </div>
  );
});

export default SuggestedVariants;
