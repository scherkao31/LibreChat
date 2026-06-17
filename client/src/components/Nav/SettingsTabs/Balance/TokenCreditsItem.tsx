import React from 'react';

interface TokenCreditsItemProps {
  /** Pourcentage de credits restants (0-100). */
  percent: number;
  /** Libelle du forfait courant (Gratuit / Pro / Premium). */
  planLabel: string;
}

/**
 * Affiche les credits restants sous forme de barre de progression (pas de nombre de tokens brut).
 */
const TokenCreditsItem: React.FC<TokenCreditsItemProps> = ({ percent, planLabel }) => {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const barColor = pct <= 10 ? 'bg-[#DA291C]' : pct <= 25 ? 'bg-amber-500' : 'bg-[#1F3A5F]';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-light text-text-primary">Crédits</span>
        <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
          Forfait {planLabel}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary">{pct}% de crédits restants ce mois</span>
    </div>
  );
};

export default TokenCreditsItem;
