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
  retention: { base: number; ret2: number; ret3: number };
  messages: { inPeriod: number; perActiveUser: number; daily: Daily[] };
  signups: { inPeriod: number; daily: Daily[] };
  tokens: {
    startBalance: number;
    consumedTotal: number;
    nearLimit: number;
    buckets: { label: string; count: number }[];
  };
};

const nf = new Intl.NumberFormat('fr-CH');
const fmt = (n: number) => nf.format(n);
const fmtM = (n: number) => (n >= 1000000 ? `${(n / 1000000).toFixed(1)} M` : fmt(n));

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
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <>
      <div className="flex h-28 items-end gap-1">
        {data.map((d) => (
          <div
            key={d.date}
            title={`${d.date} : ${d.count}`}
            className="min-h-[2px] flex-1 rounded-t bg-text-primary/70"
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
    </>
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
              <h2 className="mb-2 text-[13px] font-medium text-text-secondary">
                Activation et rétention (sur {fmt(data.retention.base)} inscrits)
              </h2>
              <StatBar
                label="A écrit un message"
                pct={data.retention.base ? (data.users.activated / data.retention.base) * 100 : 0}
                value={fmt(data.users.activated)}
              />
              <StatBar
                label="Revenu un 2e jour"
                pct={data.retention.base ? (data.retention.ret2 / data.retention.base) * 100 : 0}
                value={fmt(data.retention.ret2)}
              />
              <StatBar
                label="Revenu un 3e jour"
                pct={data.retention.base ? (data.retention.ret3 / data.retention.base) * 100 : 0}
                value={fmt(data.retention.ret3)}
              />
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
          </div>
        )}
      </div>
    </div>
  );
}
