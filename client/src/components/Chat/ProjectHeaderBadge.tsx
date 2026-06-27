import { useNavigate } from 'react-router-dom';
import { Folder } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useChatContext } from '~/Providers';
import { useProjectQuery } from '~/data-provider';

/**
 * Etiquette discrete du projet rattache a la conversation, affichee en haut a cote du
 * selecteur de modele. Presente dans TOUTES les discussions d'un projet : c'est le repere
 * qui indique que la discussion connait les documents du projet (l'ancrage se fait en
 * arriere-plan, cote serveur, sans piece jointe visible). Un clic ouvre le projet.
 */
export default function ProjectHeaderBadge() {
  const navigate = useNavigate();
  const { conversation } = useChatContext();
  const chatProjectId = conversation?.chatProjectId ?? null;
  const { data: project } = useProjectQuery(chatProjectId);

  if (!chatProjectId || !project) {
    return null;
  }

  return (
    <TooltipAnchor
      description="Ouvrir le projet"
      render={
        <button
          type="button"
          onClick={() => navigate(`/projects/${chatProjectId}`)}
          aria-label={`Projet ${project.name}, ouvrir`}
          className="flex h-8 max-w-[12rem] items-center gap-1.5 rounded-full border border-border-light bg-surface-secondary px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
        >
          <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{project.name}</span>
        </button>
      }
    />
  );
}
