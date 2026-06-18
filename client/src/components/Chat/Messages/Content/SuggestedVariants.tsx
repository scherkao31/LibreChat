import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, Mail, Pencil, ListChecks } from 'lucide-react';
import { cn } from '~/utils';

/**
 * SuggestedVariants — widget de "variantes" (plusieurs versions d'un meme texte,
 * typiquement des emails) presentees en onglets, avec :
 *  - champs a completer : les [XXX], [date], [montant]... du texte deviennent des
 *    inputs ; le texte se remplit en direct quand on les saisit ;
 *  - edition libre : un mode "Editer le texte" pour retoucher a la main ;
 *  - "Copier" : copie le texte EFFECTIF (rempli / edite) ;
 *  - "Ouvrir dans ma messagerie" : lien mailto: (objet + corps pre-remplis) qui
 *    ouvre le client mail de l'utilisateur, sans serveur. Affiche si le texte
 *    ressemble a un email (ligne "Objet :").
 *
 * Le modele emet un bloc de code fence `lancya_variants`. Format a delimiteurs
 * (pas de JSON : robuste au texte long multi-lignes) : chaque version commence
 * par une ligne "[[ Libelle ]]" suivie du texte complet.
 *
 * Modele d'etat (pour eviter les conflits) : la source par defaut est le TEMPLATE
 * (corps d'origine, avec ses [champs]) + une map valeur-par-champ -> on en derive
 * le texte "rendu". Le mode edition prend une copie modifiable de ce rendu ; tant
 * qu'on edite, l'edition fait foi. Les valeurs de champs sont partagees entre
 * onglets (un [date] saisi vaut pour toutes les versions).
 *
 * Branche UNIQUEMENT dans le composant `code` du chat. Rien ne s'affiche tant
 * qu'aucune section complete n'est parsee (robuste au streaming).
 */

type Variant = { label: string; body: string };

const SECTION_RE = /^\[\[\s*(.+?)\s*\]\]\s*$/;
const SUBJECT_RE = /^\s*(?:objet|subject)\s*:\s*(\S.*)$/i;
// Un "champ a remplir" : [texte sans crochet ni retour ligne], 1 a 40 caracteres.
const FIELD_RE = /\[[^\]\[\n]{1,40}\]/g;
// Version ancree NON globale, pour tester si une chaine EST exactement un champ
// (FIELD_RE est /g donc .test() serait stateful : a ne jamais utiliser ainsi).
const FIELD_EXACT = /^\[[^\]\[\n]{1,40}\]$/;

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

  return variants.filter((v) => v.label && v.body);
}

/** Champs uniques (tokens [x]) dans l'ordre d'apparition. */
function extractFields(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.match(FIELD_RE) ?? []) {
    if (!seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

/** Remplace chaque [champ] par sa valeur si renseignee, sinon garde le [champ]. */
function applyFields(template: string, values: Record<string, string>): string {
  return template.replace(FIELD_RE, (token) => {
    const v = values[token];
    return v && v.trim().length > 0 ? v : token;
  });
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

/** Rend le texte en surlignant les [champs] encore non remplis. */
function renderWithHighlights(text: string) {
  const parts = text.split(/(\[[^\]\[\n]{1,40}\])/g);
  return parts.map((part, i) =>
    FIELD_EXACT.test(part) ? (
      <span
        key={i}
        className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

const SuggestedVariants = memo(function SuggestedVariants({ raw }: { raw: string }) {
  const variants = useMemo(() => parseVariants(raw), [raw]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const selectTab = useCallback((idx: number) => {
    setActive(idx);
    setCopied(false);
    setEditing(false);
    setEditedBody('');
  }, []);

  const setField = useCallback((token: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [token]: value }));
  }, []);

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
  const template = variants[activeIdx].body;
  const fields = extractFields(template);
  const rendered = applyFields(template, fieldValues);
  const effective = editing ? editedBody : rendered;

  const { subject, mailBody } = splitEmail(effective);
  const isEmail = subject != null;
  const mailtoHref = isEmail
    ? `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`
    : undefined;

  const toggleEditing = () => {
    if (!editing) {
      setEditedBody(rendered);
      setEditing(true);
    } else {
      setEditing(false);
    }
    setCopied(false);
  };

  const textareaRows = Math.max(8, effective.split('\n').length + 1);

  return (
    <div className="not-prose mt-3 w-full font-sans">
      {/* Onglets : masques quand il n'y a qu'une seule version. */}
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {variants.map((variant, idx) => (
            <button
              key={`variant-tab-${idx}-${variant.label}`}
              type="button"
              onClick={() => selectTab(idx)}
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
      <div className="mt-2 rounded-2xl border border-border-medium bg-surface-secondary shadow-sm">
        {editing ? (
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={textareaRows}
            spellCheck={false}
            className="w-full resize-y rounded-t-2xl border-0 bg-transparent px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-0"
          />
        ) : (
          <div className="whitespace-pre-wrap px-4 py-3 text-sm text-text-primary">
            {renderWithHighlights(rendered)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light px-3 py-2">
          <button
            type="button"
            onClick={toggleEditing}
            className={cn(
              'mr-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary',
              'transition-colors duration-150 hover:bg-surface-tertiary hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            )}
          >
            {editing ? <ListChecks size={14} /> : <Pencil size={14} />}
            {editing ? 'Revenir aux champs' : 'Editer le texte'}
          </button>
          <button
            type="button"
            onClick={() => handleCopy(effective)}
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

      {/* Champs a completer : un input par [token] detecte (hors mode edition). */}
      {!editing && fields.length > 0 && (
        <div className="mt-2 rounded-2xl border border-border-medium bg-surface-secondary px-4 py-3 shadow-sm">
          <div className="mb-2 text-xs font-medium text-text-secondary">A completer</div>
          <div className="flex flex-col gap-2">
            {fields.map((token) => {
              const label = token.slice(1, -1);
              return (
                <label key={token} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-text-secondary" title={label}>
                    {label}
                  </span>
                  <input
                    type="text"
                    value={fieldValues[token] ?? ''}
                    onChange={(e) => setField(token, e.target.value)}
                    placeholder={token}
                    className={cn(
                      'min-w-0 flex-1 rounded-lg border border-border-medium bg-surface-primary px-3 py-1.5 text-sm text-text-primary',
                      'placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none focus:ring-0',
                    )}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      <span className="mt-1 block px-1 text-xs text-text-secondary">
        {fields.length > 0 && !editing
          ? 'Remplis les champs, puis copie ou ouvre dans ta messagerie.'
          : 'ou ecris directement ce que tu veux ajuster.'}
      </span>
    </div>
  );
});

export default SuggestedVariants;
