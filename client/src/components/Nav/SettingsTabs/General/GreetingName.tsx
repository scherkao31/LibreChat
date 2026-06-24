import { useRecoilState } from 'recoil';
import { Switch } from '@librechat/client';
import { useGetUserQuery } from '~/data-provider';
import store from '~/store';

/**
 * Reglage du nom affiche dans le message d'accueil ("Bienvenue sur Lancya, X").
 * - Interrupteur pour afficher ou masquer le nom.
 * - Champ pour choisir un nom different (vide => nom du compte).
 * Stocke en local (atomes greetingName / showGreetingName), lu par Landing.tsx.
 */
export default function GreetingName() {
  const { data: user } = useGetUserQuery();
  const [show, setShow] = useRecoilState(store.showGreetingName);
  const [name, setName] = useRecoilState(store.greetingName);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="pr-4">
          <div id="greeting-name-label">Afficher mon nom sur l'accueil</div>
          <div className="mt-1 text-xs text-text-secondary">
            Le message de bienvenue vous nomme. Désactivez pour le masquer.
          </div>
        </div>
        <Switch checked={show} onCheckedChange={setShow} aria-labelledby="greeting-name-label" />
      </div>
      {show && (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={user?.name || 'Votre nom'}
          aria-label="Nom affiché sur l'accueil"
          className="w-full rounded-lg border border-border-medium bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
        />
      )}
    </div>
  );
}
