import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import UpgradeDialog from '~/components/Nav/UpgradeDialog';

/**
 * Banniere affichee en haut du chat quand l'utilisateur n'a plus de credits.
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
  if (credits > 0) {
    return null;
  }

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-3 bg-[#DA291C] px-4 py-2 text-center text-sm text-white">
        <span>Vos crédits Lancya sont épuisés. Passez à un plan payant pour continuer.</span>
        <button
          type="button"
          onClick={() => setShowUpgrade(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-sm font-medium text-[#DA291C] transition-colors hover:bg-gray-100"
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
