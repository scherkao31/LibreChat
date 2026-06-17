import { memo, useMemo, useState, useCallback } from 'react';
import { Check, ArrowUp } from 'lucide-react';
import { cn } from '~/utils';
import { useMessageContext } from '~/Providers';
import { useSubmitMessage } from '~/hooks';

/**
 * SuggestedChoices — widget de "reponses suggerees" cliquables.
 *
 * Le modele emet, en fin de reponse, un bloc de code fence dont le langage est
 * `lancya_choices` (underscore : la regex /language-(\w+)/ ne capte pas le tiret) :
 *
 *   ```lancya_choices
 *   { "question": "Pour quel canton ?", "choices": ["Geneve", "Vaud", "Autre"] }
 *   ```
 *
 * Ce sont les reponses DE L'UTILISATEUR (ce qu'il dirait de toute facon), donc on
 * les presente cote utilisateur : pleine largeur, empilees verticalement, en bas
 * du message, juste au-dessus de la zone de saisie.
 *
 * Deux modes :
 *  - simple (defaut) : un clic = envoi immediat de la valeur comme prochain message.
 *  - multiple ("multiple": true) : cases a cocher, l'utilisateur en selectionne
 *    plusieurs puis valide ; les valeurs sont jointes en un seul message.
 * Dans les deux cas, un indice rappelle qu'il peut aussi ecrire sa propre reponse.
 *
 * Branche UNIQUEMENT dans le composant `code` du chat (pas `codeNoExecution`),
 * donc les contextes chat (useSubmitMessage / useMessageContext) sont toujours
 * presents quand ce composant est monte.
 *
 * Robustesse au streaming : le JSON arrive token par token. Tant qu'il n'est pas
 * un JSON valide et complet, on ne rend RIEN (pas de bouton a moitie forme).
 */

type ParsedChoice = { label: string; value: string };

type ChoicesPayload = {
  question?: string;
  choices: ParsedChoice[];
  multiple: boolean;
};

function readBool(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Parse tolerant : accepte `choices: ["A","B"]` ou `[{label, value}]`, et
 *  `"multiple": true` pour le mode multi-selection. Renvoie null tant que le JSON
 *  est incomplet/invalide (cas normal pendant le stream). */
function parseChoices(raw: string): ChoicesPayload | null {
  const text = raw.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  const isObject = !Array.isArray(data) && data != null && typeof data === 'object';
  // Forme courte : un tableau direct de choix.
  const rawChoices = Array.isArray(data)
    ? data
    : isObject
      ? (data as { choices?: unknown }).choices
      : undefined;

  if (!Array.isArray(rawChoices)) {
    return null;
  }

  const choices: ParsedChoice[] = [];
  for (const item of rawChoices) {
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) {
        choices.push({ label, value: label });
      }
    } else if (item != null && typeof item === 'object') {
      const obj = item as { label?: unknown; value?: unknown };
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      const value =
        typeof obj.value === 'string' && obj.value.trim().length > 0 ? obj.value.trim() : label;
      if (label) {
        choices.push({ label, value });
      }
    }
  }

  if (choices.length === 0) {
    return null;
  }

  const question =
    isObject && typeof (data as { question?: unknown }).question === 'string'
      ? (data as { question: string }).question.trim()
      : undefined;
  const multiple = isObject
    ? readBool((data as { multiple?: unknown; multiSelect?: unknown }).multiple) ||
      readBool((data as { multiSelect?: unknown }).multiSelect)
    : false;

  return { question: question || undefined, choices, multiple };
}

const SuggestedChoices = memo(function SuggestedChoices({ raw }: { raw: string }) {
  const payload = useMemo(() => parseChoices(raw), [raw]);
  const { isSubmitting = false } = useMessageContext();
  const { submitMessage } = useSubmitMessage();
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  const send = useCallback(
    (value: string) => {
      if (isSubmitting || !value.trim()) {
        return;
      }
      submitMessage({ text: value });
    },
    [isSubmitting, submitMessage],
  );

  const toggle = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  // Tant que le bloc n'est pas un JSON valide et complet (stream en cours), on
  // n'affiche rien : pas de bouton a moitie forme, pas de scintillement.
  if (!payload) {
    return null;
  }

  const { question, choices, multiple } = payload;

  const sendSelection = () => {
    const value = choices
      .filter((_, idx) => selected.has(idx))
      .map((c) => c.value)
      .join(', ');
    send(value);
  };

  const rowBase =
    'flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy';

  return (
    <div
      className="not-prose mt-3 flex w-full flex-col items-stretch gap-2 font-sans"
      role="group"
      aria-label={question ?? 'Reponses suggerees'}
    >
      {question && <span className="px-1 text-sm text-text-secondary">{question}</span>}

      {choices.map((choice, idx) => {
        const isChecked = selected.has(idx);
        return (
          <button
            key={`choice-${idx}-${choice.label}`}
            type="button"
            disabled={isSubmitting}
            aria-pressed={multiple ? isChecked : undefined}
            onClick={() => (multiple ? toggle(idx) : send(choice.value))}
            className={cn(
              rowBase,
              'bg-surface-tertiary text-text-primary hover:border-border-heavy hover:bg-surface-hover',
              multiple && isChecked
                ? 'border-border-heavy'
                : 'border-border-medium',
              isSubmitting && 'cursor-not-allowed opacity-50',
            )}
          >
            {multiple && (
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                  isChecked
                    ? 'border-surface-submit bg-surface-submit text-white'
                    : 'border-border-heavy',
                )}
                aria-hidden="true"
              >
                {isChecked && <Check size={14} strokeWidth={3} />}
              </span>
            )}
            <span className="flex-1">{choice.label}</span>
          </button>
        );
      })}

      {multiple && (
        <button
          type="button"
          disabled={isSubmitting || selected.size === 0}
          onClick={sendSelection}
          className={cn(
            'mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium',
            'bg-surface-submit text-white transition-colors duration-150 hover:bg-surface-submit-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
            (isSubmitting || selected.size === 0) && 'cursor-not-allowed opacity-40',
          )}
        >
          <ArrowUp size={16} strokeWidth={2.5} />
          {selected.size > 0
            ? `Envoyer ma selection (${selected.size})`
            : 'Selectionne une ou plusieurs options'}
        </button>
      )}

      <span className="px-1 text-xs text-text-secondary">
        ou ecris directement ta reponse ci-dessous.
      </span>
    </div>
  );
});

export default SuggestedChoices;
