/**
 * Source unique de verite pour les forfaits Lancya.
 * Utilise a la fois par la landing (AuthLayout) et le pop-up d'upgrade (UpgradeDialog),
 * pour que les liens et la detection de forfait restent synchronises.
 */

export type PlanKey = 'free' | 'pro' | 'premium';

/** Allocations de credits par plan. DOIVENT rester en phase avec PLAN_CREDITS du bridge Stripe. */
export const PRO_CREDITS = 2_700_000;
export const PREMIUM_CREDITS = 21_600_000;

/** Liens de paiement Stripe LIVE (modifier ICI met a jour la landing ET le pop-up). */
export const PRO_PAYMENT_LINK = 'https://buy.stripe.com/cNifZh9wZ3Mw2J70Xq1gs01';
export const PREMIUM_PAYMENT_LINK = 'https://buy.stripe.com/4gM6oHfVncj297vgWo1gs00';

/** Adresse de contact pour les changements de forfait (rétrogradation / annulation). */
export const BILLING_CONTACT_EMAIL = 'contact@lancya.ch';

export const PLAN_LABEL: Record<PlanKey, string> = {
  free: 'Gratuit',
  pro: 'Pro',
  premium: 'Premium',
};

export const PLAN_RANK: Record<PlanKey, number> = { free: 0, pro: 1, premium: 2 };

export interface PaidPlan {
  key: 'pro' | 'premium';
  name: string;
  price: string; // en CHF / mois
  paymentLink: string;
  features: string[];
}

export const PAID_PLANS: PaidPlan[] = [
  {
    key: 'pro',
    name: 'Pro',
    price: '17',
    paymentLink: PRO_PAYMENT_LINK,
    features: [
      'Tous les modèles, dont Lancya (le plus avancé)',
      'Recherche web et création de documents',
      'Environ 2,7 millions de crédits par mois',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '90',
    paymentLink: PREMIUM_PAYMENT_LINK,
    features: [
      'Tout le plan Pro',
      '8 fois plus de crédits (environ 21,6 millions par mois)',
      'Pour un usage intensif',
    ],
  },
];

/**
 * Deduit le forfait courant a partir du solde.
 * Le bridge Stripe fixe `refillAmount` a l'allocation du plan paye ; un compte gratuit
 * n'a pas (ou peu) de refillAmount. On utilise des seuils tolerants.
 */
export function getPlanKey(balance?: { refillAmount?: number } | null): PlanKey {
  const refill = balance?.refillAmount ?? 0;
  if (refill >= 10_000_000) {
    return 'premium';
  }
  if (refill >= 2_000_000) {
    return 'pro';
  }
  return 'free';
}
