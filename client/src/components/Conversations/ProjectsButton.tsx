import { useCallback } from 'react';
import { Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';

/**
 * Entree « Projets » de la sidebar, volontairement minimale : un seul bouton
 * qui mene a la page complete /projects (ou toute la gestion se fait). Remplace
 * l'ancien bloc (collapse + liste des projets + creer + tout afficher) pour
 * une sidebar plus epuree.
 */
export default function ProjectsButton({
  toggleNav,
  isAuthenticated,
}: {
  toggleNav: () => void;
  isAuthenticated?: boolean;
}) {
  const navigate = useNavigate();
  const localize = useLocalize();

  const openProjects = useCallback(() => {
    navigate('/projects');
    toggleNav();
  }, [navigate, toggleNav]);

  if (isAuthenticated === false) {
    return null;
  }

  return (
    <div className="px-3 text-sm">
      <button
        type="button"
        onClick={openProjects}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white"
      >
        <Folder className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{localize('com_ui_projects')}</span>
      </button>
    </div>
  );
}
