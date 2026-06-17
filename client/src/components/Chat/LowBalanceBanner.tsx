import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import UpgradeDialog from '~/components/Nav/UpgradeDialog';

/** En dessous de ce ratio de credits restants, on affiche un rappel "bientot epuises". */
const LOW_RATIO = 0.2;

/**
 * Banniere en haut du chat liee au solde de credits :
 * - rouge quand les credits sont epuises (0),
 * - orange en rappel quand il reste moins de 20% des credits.
 * Propose de passer a un plan payant (ouvre la page d'upgrade).
 */
function LowBalanceBanner() {
  const { user, isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceEnabled = startupConfig?.balance?.enabled === true;
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && balanceEnabled,
  });
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (!balanceEnabled || balanceQuery.data == null) {
    return null;
  }

  const credits = Math.round(balanceQuery.data.tokenCredits ?? 0);
  const refill = Math.round(balanceQuery.data.refillAmount ?? 0);
  const ratio = refill > 0 ? credits / refill : null;

  const isEmpty = credits <= 0;
  const isLow = !isEmpty && ratio != null && ratio < LOW_RATIO;

  if (!isEmpty && !isLow) {
    return null;
  }

  const percent = ratio != null ? Math.max(1, Math.round(ratio * 100)) : null;
  const bg = isEmpty ? 'bg-[#DA291C]' : 'bg-amber-500';
  const message = isEmpty
    ? 'Vos crédits Lancya sont épuisés. Passez à un plan payant pour continuer.'
    : `Vos crédits Lancya sont bientôt épuisés${
        percent != null ? ` (${percent}% restants)` : ''
      }. Pensez à passer à Pro.`;
  const buttonText = isEmpty ? 'text-[#DA291C]' : 'text-amber-700';

  return (
    <>
      <div
        className={`sticky top-0 z-20 flex flex-wrap items-center justify-center gap-3 ${bg} px-4 py-2 text-center text-sm text-white`}
      >
        <span>{message}</span>
        <button
          type="button"
          onClick={() => setShowUpgrade(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-sm font-medium ${buttonText} transition-colors hover:bg-gray-100`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Passer à Pro
        </button>
      </div>
      {showUpgrade && (
        <UpgradeDialog open={showUpgrade} onOpenChange={setShowUpgrade} userId={user?.id} />
      )}
    </>
  );
}

export default LowBalanceBanner;
