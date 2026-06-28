import type { ElementType } from 'react';
import { Presentation, BarChart3, Table, FileText, Images, Workflow } from 'lucide-react';
import { useChatFormContext } from '~/Providers';

/**
 * LancyaStarters — exemples cliquables sur l'ecran d'accueil, pour faire DECOUVRIR
 * les capacites (presentations, carrousels, graphiques, tableaux, comptes-rendus,
 * schemas). Un clic PRE-REMPLIT l'input (l'utilisateur edite/envoie lui-meme), il
 * n'envoie pas tout seul. Affiche uniquement sur la landing (etat vide).
 */

const STARTERS: { icon: ElementType; title: string; prompt: string }[] = [
  {
    icon: Presentation,
    title: 'Une présentation',
    prompt: 'Crée une présentation de 4 slides sur les avantages du télétravail pour une PME.',
  },
  {
    icon: Images,
    title: 'Un carrousel LinkedIn',
    prompt: 'Fais-moi un carrousel LinkedIn de 5 cartes avec 3 conseils pour mieux gérer son temps.',
  },
  {
    icon: BarChart3,
    title: 'Un graphique',
    prompt: 'Fais un graphique en barres du chiffre d’affaires 2021 à 2024 : 1,2M, 1,5M, 1,9M, 2,4M.',
  },
  {
    icon: Table,
    title: 'Un tableau comparatif',
    prompt: 'Crée un tableau comparatif de 3 offres d’abonnement pour un logiciel de gestion.',
  },
  {
    icon: Workflow,
    title: 'Un schéma',
    prompt: 'Fais un schéma du parcours client en 5 étapes, de la demande au devis.',
  },
  {
    icon: FileText,
    title: 'Un compte-rendu',
    prompt: 'Rédige un compte-rendu de réunion clair à partir de mes notes (que je vais coller).',
  },
];

export default function LancyaStarters() {
  const methods = useChatFormContext();

  // Pre-remplit l'input avec l'exemple (sans envoyer) et place le curseur a la fin,
  // pour que l'utilisateur puisse l'ajuster avant d'appuyer sur Entree.
  const fillInput = (text: string) => {
    methods.setValue('text', text, { shouldValidate: true });
    setTimeout(() => {
      const textarea = document.querySelector(
        'textarea[data-testid="text-input"]',
      ) as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }
    }, 0);
  };

  return (
    <div className="mx-auto mt-2 w-full max-w-2xl px-2">
      <div className="mb-2 px-1 text-xs text-text-secondary">Des idées pour commencer</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTERS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => fillInput(s.prompt)}
              className="group flex items-start gap-3 rounded-2xl border border-border-light bg-surface-primary px-4 py-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-medium hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
            >
              <Icon size={18} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">{s.title}</div>
                <div className="line-clamp-2 text-xs text-text-secondary">{s.prompt}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
