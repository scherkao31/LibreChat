import { Mail } from 'lucide-react';
import type { TChatProject } from 'librechat-data-provider';

/**
 * ProjectFollowedThreads — la section « Discussions suivies » du dossier vivant : les fils
 * email que l'utilisateur a attachés (via « suis cette discussion » ou le bouton « Attacher »).
 * Affichage seul ; pour les dernières nouvelles d'un fil, l'utilisateur demande en discussion
 * (« des nouvelles sur X ? ») et Lancya relit le fil. Rien tant qu'aucun fil n'est suivi.
 */
export default function ProjectFollowedThreads({ project }: { project: TChatProject }) {
  const threads = project.followedThreads ?? [];
  if (threads.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm">
      <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wider text-text-secondary">
        Discussions suivies
      </h2>
      <div className="flex flex-col gap-3">
        {threads.map((thread) => {
          const meta = [thread.from, thread.note].filter(Boolean).join(' · ');
          return (
            <div key={thread.id} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-text-secondary">
                <Mail size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text-primary">{thread.subject}</div>
                {meta ? (
                  <div className="mt-0.5 truncate text-xs text-text-secondary">{meta}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
