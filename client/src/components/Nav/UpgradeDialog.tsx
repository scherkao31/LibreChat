import { useEffect } from 'react';

/**
 * Page d'upgrade Lancya : deux plans (Pro / Premium).
 * Les boutons ouvrent le lien de paiement Stripe en passant l'identifiant
 * Lancya (client_reference_id) pour relier le paiement au bon compte.
 *
 * NOTE : liens de paiement en mode TEST. A remplacer par les liens "live"
 * au moment du passage en production.
 */
const PLANS = [
  {
    key: 'pro',
    name: 'Pro',
    price: '17',
    paymentLink: 'https://buy.stripe.com/test_3cI8wPdLdb3I4TBbwbcs800',
    highlighted: true,
    features: [
      'Tous les modeles, dont Lancya (le plus avance)',
      'Recherche web et creation de documents',
      'Environ 2,7 millions de credits par mois',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '90',
    paymentLink: 'https://buy.stripe.com/test_aFafZh7mP7RwgCjfMrcs801',
    highlighted: false,
    features: [
      'Tout le plan Pro',
      '8 fois plus de credits (environ 21,6 millions / mois)',
      'Pour un usage intensif',
    ],
  },
];

function UpgradeDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  const subscribe = (link: string) => {
    const url = userId ? `${link}?client_reference_id=${encodeURIComponent(userId)}` : link;
    window.open(url, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-center text-2xl font-bold text-text-primary">
          Passez a la vitesse superieure
        </h2>
        <p className="mb-6 text-center text-sm text-text-secondary">
          Plus de credits, votre IA hébergée en Suisse sans interruption.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`flex flex-col rounded-xl border p-6 ${
                plan.highlighted
                  ? 'border-[#DA291C] ring-1 ring-[#DA291C]'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="text-lg font-semibold text-text-primary">Lancya {plan.name}</div>
              <div className="mb-4 mt-1">
                <span className="text-3xl font-bold text-text-primary">{plan.price}</span>
                <span className="text-sm text-text-secondary"> CHF / mois</span>
              </div>
              <ul className="mb-6 flex-grow space-y-2 text-sm text-text-secondary">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#DA291C]" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => subscribe(plan.paymentLink)}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? 'bg-[#DA291C] text-white hover:bg-[#b01f15]'
                    : 'bg-surface-tertiary text-text-primary hover:bg-surface-hover'
                }`}
              >
                Choisir {plan.name}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 w-full text-center text-sm text-text-secondary hover:underline"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}

export default UpgradeDialog;
