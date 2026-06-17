import React from 'react';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { getPlanKey, PLAN_LABEL } from '~/utils/plans';
import AutoRefillSettings from './AutoRefillSettings';
import TokenCreditsItem from './TokenCreditsItem';

function Balance() {
  const localize = useLocalize();
  const { isAuthenticated } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();

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
  const planLabel = PLAN_LABEL[getPlanKey(balanceData)];

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-text-primary">
      {/* Credits restants en barre de progression */}
      <TokenCreditsItem percent={percent} planLabel={planLabel} />

      {/* Auto-refill display */}
      {renderAutoRefill()}
    </div>
  );
}

export default React.memo(Balance);
