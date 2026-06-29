import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import {
  Users,
  UserCheck,
  Activity,
  MessageSquare,
  Coins,
  AlertTriangle,
  RefreshCw,
  Clock,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import { useAuthContext } from '~/hooks';
import { cn } from '~/utils';

/**
 * UsageDashboard — tableau de bord d'usage agrege, RESERVE au compte admin produit.
 * Lit /api/admin/usage (qui exclut deja le compte admin des calculs). Activation, retention,
 * volume de messages, nouveaux inscrits et consommation du credit gratuit, par periode.
 */

const ADMIN_EMAIL = 'salim@genevia.io';

type Period = '7d' | '30d' | 'all';
type Daily = { date: string; count: number };
type Stats = {
  period: Period;
  users: {
    total: number;
    activated: number;
    activationPct: number;
    newToday: number;
    activeInPeriod: number;
  };
  retention: {
    activated: { base: number; count: number };
    j1: { base: number; count: number };
    j7: { base: number; count: number };
    j30: { base: number; count: number };
  };
  conversion: {
    paidCount: number;
    rate: number;
    byPlan: { pro: number; premium: number };
    medianTimeToConvDays: number;
    medianConsoAtConvPct: number;
    atWall: { total: number; converted: number; rate: number };
    byCohort: { month: string; signups: number; converted: number }[];
  } | null;
  revenue: { payants: number; mrrEstime: number; arpu: number; prixMensuel: number } | null;
  deepActivation: { base: number; count: number };
  goldenRule: {
    deepBase: number;
    shallowBase: number;
    deepJ7Pct: number;
    shallowJ7Pct: number;
    ratio: number | null;
  };
  timeToValue: { base: number; medianHours: number };
  signupMethods: { label: string; signups: number; activated: number }[];
  stickiness: { dau: number; wau: number; mau: number; dauMau: number; wauMau: number };
  powerUsers: { count: number; pctOfActivated: number; sharePct: number; medianMessages: number };
  engagement: Bucket[];
  activeDays: Bucket[];
  concentration: { topMessagesPct: number; topCreditsPct: number };
  heavyUsers: {
    total: number;
    byAge: Bucket[];
    avgActiveDays: number;
    avgMessages: number;
    burnPerActiveDay: number;
  };
  messages: { inPeriod: number; perActiveUser: number; daily: Daily[] };
  signups: { inPeriod: number; daily: Daily[] };
  tokens: {
    startBalance: number;
    consumedTotal: number;
    nearLimit: number;
    buckets: Bucket[];
  };
};
type Bucket = { label: string; count: number };

const nf = new Intl.NumberFormat('fr-CH');
const fmt = (n: number) => nf.format(n);
const fmtM = (n: number) => (n >= 1000000 ? `${(n / 1000000).toFixed(1)} M` : fmt(n));
const pctOf = (count: number, base: number) => (base ? (count / base) * 100 : 0);

function Card({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className={cn('rounded-xl p-4', !accent && 'bg-surface-secondary')}
      style={accent ? { backgroundColor: `${accent}1a` } : undefined}
    >
      <div
        className="flex items-center gap-1.5 text-[13px] text-text-secondary"
        style={accent ? { color: accent } : undefined}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-medium" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-text-tertiary">{sub}</div> : null}
    </div>
  );
}

function StatBar({
  label,
  value,
  pct,
  color = '#2F6FED',
}: {
  label: string;
  value: string;
  pct: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-40 shrink-0 text-[13px] text-text-secondary">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
        />
      </span>
      <span className="w-20 shrink-0 text-right text-[13px] font-medium">{value}</span>
    </div>
  );
}

function DailyChart({ data }: { data: Daily[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const active = hover != null ? data[hover] : null;
  return (
    <div className="relative">
      <div className="mb-1 h-4 text-center text-xs">
        {active ? (
          <span className="font-medium text-text-primary">
            {active.date} : {fmt(active.count)}
          </span>
        ) : (
          <span className="text-text-tertiary">Survolez une barre pour voir le nombre</span>
        )}
      </div>
      <div className="flex h-28 items-end gap-1">
        {data.map((d, i) => (
          <div
            key={d.date}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            className={cn(
              'min-h-[2px] flex-1 cursor-default rounded-t bg-text-primary transition-opacity',
              hover === i ? 'opacity-100' : 'opacity-60',
            )}
            style={{ height: `${(d.count / max) * 100}%` }}
          />
        ))}
      </div>
      {data.length > 0 ? (
        <div className="mt-1.5 flex justify-between text-[10px] text-text-tertiary">
          <span>{data[0].date.slice(5)}</span>
          <span>{data[data.length - 1].date.slice(5)}</span>
        </div>
      ) : null}
    </div>
  );
}

function BucketBars({ buckets, colors }: { buckets: Bucket[]; colors?: string[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <>
      {buckets.map((b, i) => (
        <StatBar
          key={b.label}
          label={b.label}
          pct={(b.count / max) * 100}
          value={fmt(b.count)}
          color={colors?.[i]}
        />
      ))}
    </>
  );
}

/** Une métrique avec son repère marché et un code couleur (vert = au niveau ou mieux,
 *  orange = en dessous, gris = pas assez de recul). */
function StdBar({
  label,
  count,
  base,
  std,
  stdLabel,
}: {
  label: string;
  count: number;
  base: number;
  std: number;
  stdLabel: string;
}) {
  const pct = base ? (count / base) * 100 : 0;
  const enough = base >= 10;
  const color = !enough ? '#888780' : pct >= std ? '#1D9E75' : '#BA7517';
  const verdict = !enough ? 'pas assez de recul' : pct >= std ? 'dans le standard' : 'sous le standard';
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-3">
        <span className="w-36 shrink-0 text-[13px] text-text-secondary">{label}</span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
          />
        </span>
        <span className="w-32 shrink-0 text-right text-[13px] font-medium">
          {enough ? `${Math.round(pct)}%` : '—'}{' '}
          <span className="font-normal text-text-tertiary">
            ({fmt(count)}/{fmt(base)})
          </span>
        </span>
      </div>
      <div className="ml-36 mt-0.5 text-[11px]" style={{ color }}>
        repère {stdLabel} · {verdict}
      </div>
    </div>
  );
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'all', label: 'Tout' },
];

export default function UsageDashboard() {
  const { user } = useAuthContext();
  const [period, setPeriod] = useState<Period>('30d');
  const isAdmin = user?.email === ADMIN_EMAIL;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Stats>({
    queryKey: ['admin-usage', period],
    queryFn: async () => (await axios.get(`/api/admin/usage?period=${period}`)).data,
    enabled: isAdmin,
  });

  if (user && !isAdmin) {
    return <Navigate to="/c/new" replace />;
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-surface-primary">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium text-text-primary">Usage</h1>
            <p className="text-sm text-text-secondary">Statistiques agrégées, votre compte exclu.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-border-light bg-surface-tertiary p-0.5 text-xs">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'rounded-full px-3 py-1 transition-colors',
                    period === p.key
                      ? 'bg-surface-primary font-medium text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              title="Rafraîchir"
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {!user || isLoading ? (
          <p className="py-16 text-center text-sm text-text-secondary">Chargement...</p>
        ) : isError || !data ? (
          <p className="py-16 text-center text-sm text-text-secondary">
            Impossible de charger les statistiques.
          </p>
        ) : (
          <div className="flex flex-col gap-7">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card
                icon={<Users size={15} />}
                label="Inscrits"
                value={fmt(data.users.total)}
                sub={`+${data.users.newToday} aujourd'hui`}
              />
              <Card
                icon={<UserCheck size={15} />}
                label="Activés"
                value={`${data.users.activationPct}%`}
                sub={`${fmt(data.users.activated)} ont écrit`}
              />
              <Card
                icon={<Activity size={15} />}
                label="Actifs (période)"
                value={fmt(data.users.activeInPeriod)}
                sub="au moins 1 message"
              />
              <Card
                icon={<MessageSquare size={15} />}
                label="Messages (période)"
                value={fmt(data.messages.inPeriod)}
                sub={`${data.messages.perActiveUser} / utilisateur actif`}
              />
            </div>

            <section>
              <h2 className="mb-1 text-[13px] font-medium text-text-secondary">
                Rétention par cohorte
              </h2>
              <p className="mb-3 text-xs text-text-tertiary">
                Mesurée seulement sur les comptes inscrits depuis assez longtemps pour avoir pu
                revenir (le dénominateur change selon l'horizon). Vert = au niveau du repère marché
                ou mieux, orange = en dessous, gris = pas assez de recul. La rétention J7 est le
                signal le plus prédictif.
              </p>
              <StatBar
                label="A écrit un message"
                pct={pctOf(data.retention.activated.count, data.retention.activated.base)}
                value={`${fmt(data.retention.activated.count)} / ${fmt(data.retention.activated.base)}`}
              />
              <StdBar
                label="Rétention J1"
                count={data.retention.j1.count}
                base={data.retention.j1.base}
                std={33}
                stdLabel="~33%"
              />
              <StdBar
                label="Rétention J7"
                count={data.retention.j7.count}
                base={data.retention.j7.base}
                std={20}
                stdLabel="~18 à 22%"
              />
              <StdBar
                label="Rétention J30"
                count={data.retention.j30.count}
                base={data.retention.j30.base}
                std={9.6}
                stdLabel="~9,6%"
              />
            </section>

            {data.conversion ? (
              <section>
                <h2 className="mb-1 text-[13px] font-medium text-text-secondary">Conversion</h2>
                <p className="mb-3 text-xs text-text-tertiary">
                  Un payant = a souscrit (transaction de crédits). Freemium sans expiration : la
                  conversion médiane arrive entre le 3e et le 6e mois, ne juge pas trop tôt.
                </p>
                {(() => {
                  const c = data.conversion;
                  if (!c) {
                    return null;
                  }
                  const enough = data.users.total >= 20;
                  const rateColor = !enough ? '#888780' : c.rate >= 6 ? '#1D9E75' : '#BA7517';
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Card
                          icon={<CreditCard size={15} />}
                          label="Payants"
                          value={fmt(c.paidCount)}
                          sub={`${fmt(c.byPlan.pro)} pro · ${fmt(c.byPlan.premium)} premium`}
                        />
                        <Card
                          accent={rateColor}
                          icon={<TrendingUp size={15} />}
                          label="Taux de conversion"
                          value={`${c.rate}%`}
                          sub="repère 6 à 8% (IA)"
                        />
                        <Card
                          icon={<Coins size={15} />}
                          label="Conso à la conversion"
                          value={c.paidCount ? `${c.medianConsoAtConvPct}%` : '—'}
                          sub="du gratuit (médiane)"
                        />
                        <Card
                          icon={<Clock size={15} />}
                          label="Délai de conversion"
                          value={c.paidCount ? `${c.medianTimeToConvDays} j` : '—'}
                          sub="médiane, inscription vers paiement"
                        />
                      </div>
                      <div className="mt-3 rounded-xl bg-surface-secondary p-4 text-sm leading-relaxed text-text-secondary">
                        <span className="font-medium text-text-primary">Au mur.</span> Sur{' '}
                        <span className="font-medium text-text-primary">{fmt(c.atWall.total)}</span>{' '}
                        comptes ayant atteint 90% du crédit gratuit,{' '}
                        <span className="font-medium text-text-primary">
                          {fmt(c.atWall.converted)}
                        </span>{' '}
                        sont passés payants, soit{' '}
                        <span
                          className="font-medium"
                          style={{ color: c.atWall.rate >= 5 ? '#1D9E75' : '#BA7517' }}
                        >
                          {c.atWall.rate}%
                        </span>{' '}
                        (repère 5 à 15% sur déclencheur d'usage).
                      </div>
                      {c.byCohort.length > 0 ? (
                        <div className="mt-4">
                          <div className="mb-1 text-xs text-text-tertiary">
                            Conversion par cohorte mensuelle d'inscription
                          </div>
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="text-left text-text-tertiary">
                                <th className="py-1 font-normal">Mois</th>
                                <th className="py-1 text-right font-normal">Inscrits</th>
                                <th className="py-1 text-right font-normal">Payants</th>
                                <th className="py-1 text-right font-normal">Taux</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.byCohort.map((row) => (
                                <tr key={row.month} className="border-t border-border-light">
                                  <td className="py-1.5 text-text-secondary">{row.month}</td>
                                  <td className="py-1.5 text-right">{fmt(row.signups)}</td>
                                  <td className="py-1.5 text-right">{fmt(row.converted)}</td>
                                  <td className="py-1.5 text-right font-medium">
                                    {row.signups
                                      ? Math.round((row.converted / row.signups) * 1000) / 10
                                      : 0}
                                    %
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>
            ) : (
              <section>
                <h2 className="mb-1 text-[13px] font-medium text-text-secondary">Conversion</h2>
                <p className="text-sm text-text-secondary">
                  Données de conversion indisponibles (aucune transaction de crédits trouvée).
                </p>
              </section>
            )}

            {data.revenue ? (
              <section>
                <h2 className="mb-1 text-[13px] font-medium text-text-secondary">
                  Revenu (estimation)
                </h2>
                <p className="mb-3 text-xs text-text-tertiary">
                  Estimation simple : suppose tous les payants encore actifs (le statut d'abonnement
                  n'est pas dans les données). À affiner quand la base payante grossit.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Card
                    icon={<CreditCard size={15} />}
                    label="Payants"
                    value={fmt(data.revenue.payants)}
                  />
                  <Card
                    icon={<Coins size={15} />}
                    label="MRR estimé"
                    value={`${fmt(data.revenue.mrrEstime)} CHF`}
                    sub={`${data.revenue.prixMensuel} CHF / mois`}
                  />
                  <Card
                    icon={<TrendingUp size={15} />}
                    label="ARPU"
                    value={`${data.revenue.arpu} CHF`}
                    sub="par inscrit"
                  />
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-1 text-[13px] font-medium text-text-secondary">
                Activation approfondie
              </h2>
              <p className="mb-3 text-xs text-text-tertiary">
                Plus exigeant que « a écrit un message » : revenu un 2e jour ET au moins 3 messages.
              </p>
              <StatBar
                label="Activés en profondeur"
                pct={pctOf(data.deepActivation.count, data.deepActivation.base)}
                value={`${fmt(data.deepActivation.count)} / ${fmt(data.deepActivation.base)}`}
              />
              <div className="mt-3 rounded-xl bg-surface-secondary p-4 text-sm leading-relaxed text-text-secondary">
                <span className="font-medium text-text-primary">Règle d'or.</span> Les comptes
                activés en profondeur reviennent à J7 à{' '}
                <span className="font-medium text-text-primary">{data.goldenRule.deepJ7Pct}%</span>,
                contre{' '}
                <span className="font-medium text-text-primary">
                  {data.goldenRule.shallowJ7Pct}%
                </span>{' '}
                pour les autres
                {data.goldenRule.ratio != null ? (
                  <>
                    {' '}
                    (soit{' '}
                    <span
                      className="font-medium"
                      style={{ color: data.goldenRule.ratio >= 2 ? '#1D9E75' : '#BA7517' }}
                    >
                      {data.goldenRule.ratio}x
                    </span>{' '}
                    {data.goldenRule.ratio >= 2 ? 'mieux, sain' : 'mieux, sous la cible de 2x'})
                  </>
                ) : (
                  ' (pas assez de recul pour le ratio)'
                )}
                .
              </div>
              {(() => {
                const ttv = data.timeToValue;
                const enough = ttv.base >= 10;
                const good = ttv.medianHours <= 36;
                const color = !enough ? '#888780' : good ? '#1D9E75' : '#BA7517';
                const label =
                  ttv.medianHours < 48
                    ? `${ttv.medianHours} h`
                    : `${(ttv.medianHours / 24).toFixed(1)} j`;
                return (
                  <div className="mt-3">
                    <Card
                      accent={color}
                      icon={<Clock size={15} />}
                      label="Time to value (médiane inscription vers 3e message)"
                      value={enough ? label : '—'}
                      sub={`repère ~36 h · ${
                        enough ? (good ? 'rapide' : 'lent') : 'pas assez de recul'
                      } · sur ${fmt(ttv.base)} comptes`}
                    />
                  </div>
                );
              })()}
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-medium text-text-secondary">
                Profondeur d'engagement (messages par compte activé)
              </h2>
              <BucketBars buckets={data.engagement} />
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-medium text-text-secondary">
                Régularité (jours actifs distincts par compte activé)
              </h2>
              <BucketBars buckets={data.activeDays} />
            </section>

            <section>
              <h2 className="mb-1 text-[13px] font-medium text-text-secondary">
                Engagement et stickiness
              </h2>
              <p className="mb-3 text-xs text-text-tertiary">
                Stickiness = part des actifs du mois qui reviennent dans la journée / la semaine.
                Repère B2B environ 20%, outil consulté au quotidien 50% et plus.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card
                  icon={<Activity size={15} />}
                  label="DAU / MAU"
                  value={`${data.stickiness.dauMau}%`}
                  sub={`${fmt(data.stickiness.dau)} actifs aujourd'hui`}
                />
                <Card
                  icon={<Activity size={15} />}
                  label="WAU / MAU"
                  value={`${data.stickiness.wauMau}%`}
                  sub={`${fmt(data.stickiness.wau)} actifs sur 7j`}
                />
                <Card
                  icon={<MessageSquare size={15} />}
                  label="Messages (médiane)"
                  value={fmt(data.powerUsers.medianMessages)}
                  sub="par compte activé"
                />
                <Card
                  icon={<UserCheck size={15} />}
                  label="Power users"
                  value={fmt(data.powerUsers.count)}
                  sub={`${data.powerUsers.sharePct}% des messages`}
                />
              </div>
              <p className="mt-2 text-xs text-text-tertiary">
                Power user = plus de 75% du crédit consommé, ou plus de 50 messages.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-medium text-text-secondary">
                Méthode d'inscription
              </h2>
              {data.signupMethods.map((m) => (
                <StatBar
                  key={m.label}
                  label={m.label}
                  pct={pctOf(m.signups, data.users.total)}
                  value={`${fmt(m.signups)} · ${
                    m.signups ? Math.round((m.activated / m.signups) * 100) : 0
                  }% activés`}
                />
              ))}
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-medium text-text-secondary">Concentration</h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                Le top 10% des comptes actifs représente{' '}
                <span className="font-medium text-text-primary">
                  {data.concentration.topMessagesPct}%
                </span>{' '}
                des messages et{' '}
                <span className="font-medium text-text-primary">
                  {data.concentration.topCreditsPct}%
                </span>{' '}
                des crédits consommés.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-[13px] font-medium text-text-secondary">Messages par jour</h2>
              <DailyChart data={data.messages.daily} />
            </section>

            <section>
              <h2 className="mb-3 text-[13px] font-medium text-text-secondary">
                Nouveaux inscrits par jour
              </h2>
              <DailyChart data={data.signups.daily} />
            </section>

            <section>
              <h2 className="mb-2 text-[13px] font-medium text-text-secondary">
                Consommation du crédit gratuit ({fmtM(data.tokens.startBalance)} par inscrit)
              </h2>
              {(() => {
                const maxB = Math.max(1, ...data.tokens.buckets.map((b) => b.count));
                const colors = ['#888780', '#888780', '#888780', '#BA7517', '#E24B4A'];
                return data.tokens.buckets.map((b, i) => (
                  <StatBar
                    key={b.label}
                    label={b.label}
                    pct={(b.count / maxB) * 100}
                    value={fmt(b.count)}
                    color={colors[i] || '#888780'}
                  />
                ));
              })()}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Card
                  accent="#E24B4A"
                  icon={<AlertTriangle size={15} />}
                  label="Proches de la limite"
                  value={fmt(data.tokens.nearLimit)}
                  sub="plus de 90% utilisé"
                />
                <Card
                  icon={<Coins size={15} />}
                  label="Crédits consommés"
                  value={fmtM(data.tokens.consumedTotal)}
                  sub={`sur ${fmtM(data.tokens.startBalance * data.users.total)} offerts`}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-1 text-[13px] font-medium text-text-secondary">
                Gros consommateurs (plus de 75% du crédit)
              </h2>
              <p className="mb-3 text-xs text-text-tertiary">
                {fmt(data.heavyUsers.total)} comptes. Des nouveaux qui bingent, ou des fidèles qui
                usent dans la durée ?
              </p>
              <BucketBars
                buckets={data.heavyUsers.byAge}
                colors={['#E24B4A', '#BA7517', '#1D9E75']}
              />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Card
                  icon={<Activity size={15} />}
                  label="Jours actifs (moy.)"
                  value={data.heavyUsers.avgActiveDays}
                />
                <Card
                  icon={<MessageSquare size={15} />}
                  label="Messages (moy.)"
                  value={fmt(data.heavyUsers.avgMessages)}
                />
                <Card
                  icon={<Coins size={15} />}
                  label="Crédits / jour actif"
                  value={fmtM(data.heavyUsers.burnPerActiveDay)}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
