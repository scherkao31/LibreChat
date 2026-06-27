import { useEffect, useState } from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import type {
  TChatProject,
  TChatProjectFicheItem,
  TChatProjectFicheSection,
} from 'librechat-data-provider';
import { useUpdateProjectMutation } from '~/data-provider';
import { cn } from '~/utils';

/**
 * ProjectFiche — la "fiche vivante" d'un projet : un etat structure que l'IA construit
 * et tient a jour AUTOMATIQUEMENT a partir des documents du projet et des echanges (le
 * debrief LLM arrive a l'increment suivant). Ce n'est PAS un formulaire a remplir a la
 * main. Les elements proposes par l'IA (status 'proposed') s'affichent avec Valider /
 * Rejeter ; les valides peuvent etre retires. Sauvegarde via le PATCH du projet.
 */

const SECTIONS: { key: TChatProjectFicheSection; label: string }[] = [
  { key: 'decision', label: 'Décisions' },
  { key: 'open', label: 'Points ouverts' },
  { key: 'deadline', label: 'Échéances' },
  { key: 'action', label: 'Prochaines actions' },
  { key: 'info', label: 'À retenir' },
];

export default function ProjectFiche({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const update = useUpdateProjectMutation();
  const stamp = project.fiche?.updatedAt ?? null;

  const [summary, setSummary] = useState(project.fiche?.summary ?? '');
  const [items, setItems] = useState<TChatProjectFicheItem[]>(project.fiche?.items ?? []);

  useEffect(() => {
    setSummary(project.fiche?.summary ?? '');
    setItems(project.fiche?.items ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const persist = (nextItems: TChatProjectFicheItem[]) => {
    update.mutate({ projectId, fiche: { summary, items: nextItems } });
  };
  const validate = (id: string) => {
    const next = items.map((it) => (it.id === id ? { ...it, status: 'validated' as const } : it));
    setItems(next);
    persist(next);
  };
  const remove = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    persist(next);
  };

  const proposedCount = items.filter((it) => it.status === 'proposed').length;
  const isEmpty = items.length === 0 && !summary.trim();

  return (
    <section className="mt-6 rounded-2xl border border-border-light bg-surface-secondary p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Fiche du projet
        </h2>
        {proposedCount > 0 && (
          <span className="rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            {proposedCount} à valider
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2.5 px-4 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-text-tertiary">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
            La fiche se construit toute seule à partir des documents que vous ajoutez et de vos
            échanges. Vous saurez toujours où en est ce projet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.trim() ? (
            <p className="text-[15px] leading-relaxed text-text-primary">{summary}</p>
          ) : null}

          {SECTIONS.map((sec) => {
            const secItems = items.filter((it) => it.section === sec.key);
            if (secItems.length === 0) {
              return null;
            }
            return (
              <div key={sec.key}>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                  {sec.label}
                </div>
                <div className="flex flex-col">
                  {secItems.map((it) => {
                    const proposed = it.status === 'proposed';
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          'group -mx-2 flex items-start gap-3 rounded-lg px-2 py-1.5',
                          proposed && 'bg-surface-tertiary',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                            proposed ? 'bg-text-tertiary' : 'bg-text-secondary',
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={cn('text-sm text-text-primary', proposed && 'italic')}>
                            {it.text}
                          </div>
                          {it.source ? (
                            <div className="mt-0.5 text-[11px] text-text-tertiary">
                              {it.source}
                            </div>
                          ) : null}
                        </div>
                        {proposed ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => validate(it.id)}
                              title="Valider"
                              className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-primary hover:text-text-primary"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(it.id)}
                              title="Rejeter"
                              className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-primary hover:text-text-primary"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => remove(it.id)}
                            title="Retirer"
                            className="shrink-0 rounded-md p-1 text-text-tertiary opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
