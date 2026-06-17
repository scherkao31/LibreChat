import { useEffect } from 'react';
import { Check } from 'lucide-react';
import {
  PAID_PLANS,
  PLAN_LABEL,
  PLAN_RANK,
  BILLING_CONTACT_EMAIL,
  type PlanKey,
} from '~/utils/plans';

/**
 * Pop-up des forfaits Lancya. Source unique des forfaits dans utils/plans.ts
 * (partagee avec la landing). Les boutons s'adaptent au forfait actuel :
 * - forfait courant : "Votre forfait actuel" (desactive)
 * - superieur : "Passer a X" (ouvre le paiement Stripe, en passant le userId)
 * - inferieur : "Retrograder vers X" (contact, pour eviter un double abonnement)
 */
function UpgradeDialog({
  open,
  onOpenChange,
  userId,
  currentPlan = 'free',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  currentPlan?: PlanKey;
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

  const contactToChange = (planName: string) => {
    window.location.href = `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(
      `Changer de forfait Lancya vers ${planName}`,
    )}`;
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
          {currentPlan === 'free' ? 'Choisissez votre forfait' : 'Votre forfait Lancya'}
        </h2>
        <p className="mb-6 text-center text-sm text-text-secondary">
          Forfait actuel : <span className="font-semibold">{PLAN_LABEL[currentPlan]}</span>
          {currentPlan === 'free' && '. Vos données restent hébergées en Suisse, sans interruption.'}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PAID_PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const isUpgrade = PLAN_RANK[plan.key] > PLAN_RANK[currentPlan];

            return (
              <div
                key={plan.key}
                className={`flex flex-col rounded-xl border p-6 ${
                  isCurrent
                    ? 'border-[#1F3A5F] ring-1 ring-[#1F3A5F]'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-text-primary">
                    Lancya {plan.name}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-[#1F3A5F] px-2 py-0.5 text-xs font-medium text-white">
                      Actuel
                    </span>
                  )}
                </div>
                <div className="mb-4 mt-1">
                  <span className="text-3xl font-bold text-text-primary">{plan.price}</span>
                  <span className="text-sm text-text-secondary"> CHF / mois</span>
                </div>
                <ul className="mb-6 flex-grow space-y-2 text-sm text-text-secondary">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#1F3A5F]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-default rounded-xl bg-surface-tertiary px-4 py-2.5 text-sm font-medium text-text-secondary"
                  >
                    Votre forfait actuel
                  </button>
                ) : isUpgrade ? (
                  <button
                    type="button"
                    onClick={() => subscribe(plan.paymentLink)}
                    className="w-full rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#16293f]"
                  >
                    Passer à {plan.name}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => contactToChange(plan.name)}
                    className="w-full rounded-xl bg-surface-tertiary px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    Rétrograder vers {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-6 w-full text-center text-sm text-text-secondary hover:underline"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export default UpgradeDialog;
