import { useEffect, useState } from 'react';
import { Check, X, Plus, Trash2 } from 'lucide-react';
import type {
  TChatProject,
  TChatProjectFicheItem,
  TChatProjectFicheSection,
} from 'librechat-data-provider';
import { useUpdateProjectMutation } from '~/data-provider';
import { cn } from '~/utils';

/**
 * ProjectFiche — la "fiche vivante" d'un projet (dossier vivant) : l'etat structure et
 * evolutif (resume, decisions, points ouverts, echeances, actions). Les elements proposes
 * par l'IA (status 'proposed') s'y affichent avec Valider / Rejeter ; les valides sont
 * editables et supprimables ; on peut aussi en ajouter a la main. Tout est sauvegarde via
 * le PATCH du projet (remplacement complet de la liste). Le debrief LLM (qui PROPOSE des
 * elements) arrive a l'increment suivant.
 */

const SECTIONS: { key: TChatProjectFicheSection; label: string }[] = [
  { key: 'decision', label: 'Décisions et points clés' },
  { key: 'open', label: 'Points ouverts' },
  { key: 'deadline', label: 'Échéances' },
  { key: 'action', label: 'Prochaines actions' },
  { key: 'info', label: 'Infos' },
];

let idCounter = 0;
const newId = () => `f-${Date.now()}-${idCounter++}`;

export default function ProjectFiche({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const update = useUpdateProjectMutation();
  const stamp = project.fiche?.updatedAt ?? null;

  const [summary, setSummary] = useState(project.fiche?.summary ?? '');
  const [items, setItems] = useState<TChatProjectFicheItem[]>(project.fiche?.items ?? []);

  // Re-seed quand la fiche change cote serveur (ex: un debrief la met a jour), pour ne
  // pas ecraser ces changements avec notre etat local.
  useEffect(() => {
    setSummary(project.fiche?.summary ?? '');
    setItems(project.fiche?.items ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const persist = (nextItems: TChatProjectFicheItem[], nextSummary = summary) => {
    update.mutate({ projectId, fiche: { summary: nextSummary, items: nextItems } });
  };

  const setText = (id: string, text: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
  const validate = (id: string) => {
    const next = items.map((it) =>
      it.id === id ? { ...it, status: 'validated' as const } : it,
    );
    setItems(next);
    persist(next);
  };
  const remove = (id: string) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    persist(next);
  };

  const [adding, setAdding] = useState(false);
  const [addSection, setAddSection] = useState<TChatProjectFicheSection>('open');
  const [addText, setAddText] = useState('');
  const addItem = () => {
    if (!addText.trim()) {
      return;
    }
    const next = [
      ...items,
      {
        id: newId(),
        section: addSection,
        text: addText.trim(),
        source: '',
        status: 'validated' as const,
      },
    ];
    setItems(next);
    persist(next);
    setAddText('');
    setAdding(false);
  };

  const proposedCount = items.filter((it) => it.status === 'proposed').length;
  const isEmpty = items.length === 0 && !summary.trim();

  return (
    <section className="mt-6 rounded-2xl border border-border-medium bg-surface-secondary p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Fiche du projet</h2>
        {proposedCount > 0 && (
          <span className="rounded-full bg-surface-submit px-2 py-0.5 text-[11px] font-medium text-white">
            {proposedCount} à valider
          </span>
        )}
      </div>

      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onBlur={() => persist(items)}
        rows={2}
        placeholder="Résumé du projet (où en est-on ?)"
        className="mb-3 w-full resize-none rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
      />

      {SECTIONS.map((sec) => {
        const secItems = items.filter((it) => it.section === sec.key);
        if (secItems.length === 0) {
          return null;
        }
        return (
          <div key={sec.key} className="mb-3 last:mb-0">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
              {sec.label}
            </div>
            <div className="flex flex-col gap-1">
              {secItems.map((it) => {
                const proposed = it.status === 'proposed';
                return (
                  <div
                    key={it.id}
                    className={cn(
                      'flex items-start gap-2 rounded-lg px-2 py-1.5',
                      proposed ? 'bg-surface-tertiary' : 'bg-surface-primary',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      {proposed ? (
                        <div className="text-sm italic text-text-primary">{it.text}</div>
                      ) : (
                        <input
                          value={it.text}
                          onChange={(e) => setText(it.id, e.target.value)}
                          onBlur={() => persist(items)}
                          className="w-full bg-transparent text-sm text-text-primary focus:outline-none"
                        />
                      )}
                      {it.source ? (
                        <div className="mt-0.5 text-[11px] text-text-tertiary">source : {it.source}</div>
                      ) : null}
                    </div>
                    {proposed ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => validate(it.id)}
                          title="Valider"
                          className="rounded-md p-1 text-text-secondary hover:bg-surface-primary hover:text-text-primary"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          title="Rejeter"
                          className="rounded-md p-1 text-text-secondary hover:bg-surface-primary hover:text-text-primary"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        title="Supprimer"
                        className="shrink-0 rounded-md p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {isEmpty && (
        <p className="mb-2 text-xs text-text-secondary">
          La fiche se remplira au fil de vos échanges dans le projet. Vous pouvez aussi ajouter des
          éléments à la main.
        </p>
      )}

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={addSection}
            onChange={(e) => setAddSection(e.target.value as TChatProjectFicheSection)}
            className="rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-xs text-text-primary focus:outline-none"
          >
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            autoFocus
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Nouvel élément"
            className="min-w-0 flex-1 rounded-lg border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-surface-submit px-3 py-1.5 text-xs font-medium text-white"
          >
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
        >
          <Plus size={14} />
          Ajouter un élément
        </button>
      )}
    </section>
  );
}
