import { memo, useMemo, useCallback } from 'react';
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
 * Chaque choix devient un bouton ; au clic, sa valeur est envoyee comme NOUVEAU
 * message utilisateur (meme mecanisme que les amorces de conversation). On evite
 * ainsi de faire taper a l'utilisateur ce qu'il aurait de toute facon ecrit.
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
};

/** Parse tolerant : accepte `choices: ["A","B"]` ou `[{label, value}]`. Renvoie
 *  null tant que le JSON est incomplet/invalide (cas normal pendant le stream). */
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

  // Forme courte : un tableau direct de choix.
  const rawChoices = Array.isArray(data)
    ? data
    : data != null && typeof data === 'object'
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
        typeof obj.value === 'string' && obj.value.trim().length > 0
          ? obj.value.trim()
          : label;
      if (label) {
        choices.push({ label, value });
      }
    }
  }

  if (choices.length === 0) {
    return null;
  }

  const question =
    !Array.isArray(data) && data != null && typeof data === 'object'
      ? typeof (data as { question?: unknown }).question === 'string'
        ? (data as { question: string }).question.trim()
        : undefined
      : undefined;

  return { question: question || undefined, choices };
}

const SuggestedChoices = memo(function SuggestedChoices({ raw }: { raw: string }) {
  const payload = useMemo(() => parseChoices(raw), [raw]);
  const { isSubmitting = false } = useMessageContext();
  const { submitMessage } = useSubmitMessage();

  const handleClick = useCallback(
    (value: string) => {
      if (isSubmitting) {
        return;
      }
      submitMessage({ text: value });
    },
    [isSubmitting, submitMessage],
  );

  // Tant que le bloc n'est pas un JSON valide et complet (stream en cours), on
  // n'affiche rien : pas de bouton a moitie forme, pas de scintillement.
  if (!payload) {
    return null;
  }

  return (
    <div
      className="not-prose my-3 flex flex-col gap-2 font-sans"
      role="group"
      aria-label={payload.question ?? 'Suggestions'}
    >
      {payload.question && (
        <span className="text-sm text-text-secondary">{payload.question}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {payload.choices.map((choice, idx) => (
          <button
            key={`choice-${idx}-${choice.label}`}
            type="button"
            disabled={isSubmitting}
            onClick={() => handleClick(choice.value)}
            className={cn(
              'rounded-2xl border border-border-medium bg-surface-secondary px-3.5 py-2 text-left text-sm text-text-primary',
              'transition-colors duration-150 hover:border-border-heavy hover:bg-surface-tertiary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-heavy',
              isSubmitting && 'cursor-not-allowed opacity-50',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
});

export default SuggestedChoices;
