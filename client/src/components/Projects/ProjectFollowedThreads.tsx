import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, RefreshCw, Loader2, X } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { TChatProject } from 'librechat-data-provider';
import { useUpdateProjectMutation } from '~/data-provider';

/**
 * ProjectFollowedThreads — la section « Discussions suivies » du dossier vivant : les fils email
 * rattachés au dossier (via « suis cette discussion », le bouton « Attacher » d'un mail dans le
 * chat, ou le bouton « Vérifier les mails » ci-dessous qui cherche les mails liés au dossier).
 * Affichage + retrait en un clic. Symétrique de ProjectAgendaEvents.
 */
export default function ProjectFollowedThreads({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const update = useUpdateProjectMutation();
  const [checking, setChecking] = useState(false);

  const threads = project.followedThreads ?? [];

  const removeThread = (id: string) => {
    const filtered = threads.filter((t) => t.id !== id);
    queryClient.setQueryData([QueryKeys.project, projectId], {
      ...project,
      followedThreads: filtered,
    });
    update.mutate({ projectId, followedThreads: filtered });
  };

  const check = async () => {
    if (checking) {
      return;
    }
    setChecking(true);
    try {
      const updated = await dataService.checkProjectEmails(projectId);
      queryClient.setQueryData([QueryKeys.project, projectId], updated);
      const added = Math.max(0, (updated.followedThreads?.length ?? 0) - threads.length);
      showToast({
        message:
          added > 0
            ? `${added} mail${added > 1 ? 's' : ''} lié${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} au dossier.`
            : 'Aucun nouveau mail lié trouvé.',
        status: added > 0 ? 'success' : 'warning',
      });
    } catch {
      showToast({ message: 'La vérification des mails a échoué.', status: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Discussions suivies
        </h2>
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checking ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={13} aria-hidden="true" />
          )}
          {checking ? 'Vérification...' : 'Vérifier les mails'}
        </button>
      </div>

      {threads.length === 0 ? (
        <p className="px-1 py-1 text-sm leading-relaxed text-text-secondary">
          Cliquez « Vérifier les mails » pour retrouver les échanges liés à ce dossier, ou attachez
          une discussion depuis le chat.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((thread) => {
            const meta = [thread.from, thread.note].filter(Boolean).join(' · ');
            return (
              <div key={thread.id} className="group flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-text-secondary">
                  <Mail size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-primary">
                    {thread.subject}
                  </div>
                  {meta ? (
                    <div className="mt-0.5 truncate text-xs text-text-secondary">{meta}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeThread(thread.id)}
                  title="Retirer cette discussion du dossier"
                  className="shrink-0 rounded-md p-1 text-text-tertiary opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
