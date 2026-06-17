import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, Mail } from 'lucide-react';
import { cn } from '~/utils';

/**
 * SuggestedVariants — widget de "variantes" (plusieurs versions d'un meme texte,
 * typiquement des emails) presentees en onglets, avec copie et ouverture dans la
 * messagerie de l'utilisateur.
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
 * Une seule section -> pas d'onglets, juste la carte (cas d'un email unique).
 * Sous la variante active :
 *  - "Copier" : copie le corps complet dans le presse-papier ;
 *  - "Ouvrir dans ma messagerie" : lien mailto: (objet + corps pre-remplis) qui
 *    ouvre le client mail de l'utilisateur. Aucun serveur, aucun intermediaire.
 *    Affiche uniquement si le corps ressemble a un email (ligne "Objet :").
 *
 * Branche UNIQUEMENT dans le composant `code` du chat. Rien ne s'affiche tant
 * qu'aucune section complete n'est parsee (robuste au streaming).
 */

type Variant = { label: string; body: string };

const SECTION_RE = /^\[\[\s*(.+?)\s*\]\]\s*$/;
const SUBJECT_RE = /^\s*(?:objet|subject)\s*:\s*(\S.*)$/i;

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

/** Separe l'objet (ligne "Objet :" / "Subject:") du corps, pour pre-remplir le
 *  mailto. Renvoie subject undefined si le texte ne ressemble pas a un email. */
function splitEmail(body: string): { subject?: string; mailBody: string } {
  const lines = body.split('\n');
  const idx = lines.findIndex((l) => SUBJECT_RE.test(l));
  if (idx === -1) {
    return { mailBody: body };
  }
  const subject = (SUBJECT_RE.exec(lines[idx])?.[1] ?? '').trim();
  const mailBody = [...lines.slice(0, idx), ...lines.slice(idx + 1)].join('\n').trim();
  return { subject, mailBody };
}

const SuggestedVariants = memo(function SuggestedVariants({ raw }: { raw: string }) {
  const variants = useMemo(() => parseVariants(raw), [raw]);
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

  if (variants.length === 0) {
    return null;
  }

  const activeIdx = Math.min(active, variants.length - 1);
  const activeVariant = variants[activeIdx];
  const { subject, mailBody } = splitEmail(activeVariant.body);
  const isEmail = subject != null;
  const mailtoHref = isEmail
    ? `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`
    : undefined;

  return (
    <div className="not-prose mt-3 w-full font-sans">
      {/* Onglets : masques quand il n'y a qu'une seule version. */}
      {variants.length > 1 && (
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
      )}

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
          {mailtoHref && (
            <a
              href={mailtoHref}
              className={cn(
                'flex items-center gap-1.5 rounded-lg bg-surface-submit px-3 py-1.5 text-xs font-medium text-white',
                'transition-colors duration-150 hover:bg-surface-submit-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
              )}
            >
              <Mail size={14} strokeWidth={2.5} />
              Ouvrir dans ma messagerie
            </a>
          )}
        </div>
      </div>

      <span className="mt-1 block px-1 text-xs text-text-secondary">
        ou ecris directement ce que tu veux ajuster.
      </span>
    </div>
  );
});

export default SuggestedVariants;
