import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { TChatProject } from 'librechat-data-provider';

/** Formate « 5 juillet, 14h00 » à partir de la date ISO de début. */
function formatWhen(start?: string | null): string {
  if (!start) {
    return '';
  }
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

/**
 * ProjectAgendaEvents — la section « Prochains rendez-vous » du dossier vivant. Le bouton
 * « Vérifier l'agenda » déclenche (l'utilisateur, rien d'automatique) la recherche des rendez-vous
 * liés au dossier dans l'agenda connecté, et les range ici. Lecture seule.
 */
export default function ProjectAgendaEvents({ project }: { project: TChatProject }) {
  const projectId = project._id;
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const [checking, setChecking] = useState(false);

  const events = project.agendaEvents ?? [];
  const checked = project.agendaCheckedAt != null;

  const check = async () => {
    if (checking) {
      return;
    }
    setChecking(true);
    try {
      const updated = await dataService.checkProjectAgenda(projectId);
      queryClient.setQueryData([QueryKeys.project, projectId], updated);
      const n = updated.agendaEvents?.length ?? 0;
      showToast({
        message:
          n > 0
            ? `${n} rendez-vous lié${n > 1 ? 's' : ''} au dossier.`
            : 'Aucun rendez-vous lié trouvé.',
        status: n > 0 ? 'success' : 'warning',
      });
    } catch {
      showToast({ message: "La vérification de l'agenda a échoué.", status: 'error' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-secondary">
          Prochains rendez-vous
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
          {checking ? 'Vérification...' : "Vérifier l'agenda"}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="px-1 py-1 text-sm leading-relaxed text-text-secondary">
          {checked
            ? 'Aucun rendez-vous lié à ce dossier pour le moment.'
            : "Cliquez « Vérifier l'agenda » pour retrouver les rendez-vous liés à ce dossier."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((ev) => {
            const meta = [formatWhen(ev.start), ev.location].filter(Boolean).join(' · ');
            return (
              <div key={ev.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-text-secondary">
                  <Calendar size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-primary">
                    {ev.summary || 'Rendez-vous'}
                  </div>
                  {meta ? (
                    <div className="mt-0.5 truncate text-xs text-text-secondary">{meta}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
