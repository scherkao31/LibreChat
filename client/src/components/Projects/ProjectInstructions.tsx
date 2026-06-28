import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { TChatProject } from 'librechat-data-provider';
import { useUpdateProjectMutation } from '~/data-provider';
import { cn } from '~/utils';

/**
 * ProjectInstructions — un contexte permanent du dossier (de quoi il s'agit, le ton attendu,
 * ce qu'il faut toujours garder en tête). Injecté côté serveur dans le prompt de TOUTES les
 * conversations du dossier (comme les « instructions » des Projects de Claude/ChatGPT).
 * Sauvegarde au blur, ou via le bouton « Enregistrer » qui apparaît quand le texte a changé.
 */
export default function ProjectInstructions({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const update = useUpdateProjectMutation();
  const saved = project.instructions ?? '';
  const [value, setValue] = useState(saved);

  useEffect(() => {
    setValue(project.instructions ?? '');
  }, [project.instructions]);

  const dirty = value.trim() !== saved.trim();

  const onSave = () => {
    if (!dirty || update.isLoading) {
      return;
    }
    update.mutate({ projectId, instructions: value.trim() });
  };

  return (
    <section className="mt-4 rounded-2xl border border-border-light bg-surface-secondary p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Instructions
        </h2>
        {update.isLoading ? (
          <Loader2 size={14} className="animate-spin text-text-tertiary" aria-hidden="true" />
        ) : dirty ? (
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          >
            Enregistrer
          </button>
        ) : null}
      </div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={onSave}
        rows={3}
        placeholder="Contexte permanent du dossier : de quoi il s'agit, le ton attendu, ce qu'il faut toujours garder en tête. L'IA en tiendra compte dans toutes les discussions du dossier."
        className={cn(
          'w-full resize-y rounded-xl border border-border-medium bg-surface-primary px-3 py-2 text-sm leading-relaxed text-text-primary',
          'placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none focus:ring-0',
        )}
      />
    </section>
  );
}
