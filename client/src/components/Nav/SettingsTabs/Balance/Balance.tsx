import React, { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import {
  getPlanKey,
  PLAN_LABEL,
  BILLING_PORTAL_LINK,
  BILLING_CONTACT_EMAIL,
} from '~/utils/plans';
import UpgradeDialog from '~/components/Nav/UpgradeDialog';
import AutoRefillSettings from './AutoRefillSettings';
import TokenCreditsItem from './TokenCreditsItem';

function Balance() {
  const localize = useLocalize();
  const { isAuthenticated, user } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && !!startupConfig?.balance?.enabled,
  });
  const balanceData = balanceQuery.data;

  // Pull out all the fields we need, with safe defaults
  const {
    tokenCredits = 0,
    autoRefillEnabled = false,
    lastRefill,
    refillAmount,
    refillIntervalUnit,
    refillIntervalValue,
  } = balanceData ?? {};

  // Check that all auto-refill props are present
  const hasValidRefillSettings =
    lastRefill !== undefined &&
    refillAmount !== undefined &&
    refillIntervalUnit !== undefined &&
    refillIntervalValue !== undefined;

  const renderAutoRefill = () => {
    if (!autoRefillEnabled) {
      return (
        <div className="text-sm text-gray-600">
          {localize('com_nav_balance_auto_refill_disabled')}
        </div>
      );
    }
    if (!hasValidRefillSettings) {
      return (
        <div className="text-sm text-red-600">{localize('com_nav_balance_auto_refill_error')}</div>
      );
    }
    return (
      <AutoRefillSettings
        lastRefill={lastRefill}
        refillAmount={refillAmount}
        refillIntervalUnit={refillIntervalUnit}
        refillIntervalValue={refillIntervalValue}
      />
    );
  };

  const startBalance =
    (startupConfig?.balance as { startBalance?: number } | undefined)?.startBalance ?? 0;
  const max = refillAmount && refillAmount > 0 ? refillAmount : startBalance || tokenCredits || 1;
  const percent = Math.max(0, Math.min(100, Math.round((tokenCredits / max) * 100)));
  const planKey = getPlanKey(balanceData);
  const planLabel = PLAN_LABEL[planKey];
  const isPaid = planKey !== 'free';

  // Self-serve : portail client Stripe si configure, sinon repli sur l'email de contact.
  const manageSubscription = () => {
    if (BILLING_PORTAL_LINK) {
      window.open(BILLING_PORTAL_LINK, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = `mailto:${BILLING_CONTACT_EMAIL}?subject=${encodeURIComponent(
        'Gestion de mon abonnement Lancya',
      )}`;
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-text-primary">
      {/* Credits restants en barre de progression */}
      <TokenCreditsItem percent={percent} planLabel={planLabel} />

      {/* Auto-refill display */}
      {renderAutoRefill()}

      {/* Mon abonnement */}
      <div className="flex flex-col gap-3 border-t border-border-medium pt-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <CreditCard size={16} aria-hidden="true" />
          Mon abonnement
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Forfait actuel</span>
          <span className="font-medium">{planLabel}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            className="flex-1 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90"
          >
            {isPaid ? 'Changer de formule' : 'Choisir un forfait'}
          </button>
          {isPaid && (
            <button
              type="button"
              onClick={manageSubscription}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary"
            >
              Gérer ou résilier
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs text-text-secondary">
          Vous pouvez changer de formule ou résilier à tout moment.
        </p>
      </div>

      {showUpgrade && (
        <UpgradeDialog
          open={showUpgrade}
          onOpenChange={setShowUpgrade}
          userId={user?.id}
          currentPlan={planKey}
        />
      )}
    </div>
  );
}

export default React.memo(Balance);
