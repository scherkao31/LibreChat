import { ThemeSelector } from '@librechat/client';
import { TStartupConfig, registerPage } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

const PAYMENT_LINK_PRO = 'https://buy.stripe.com/test_3cI8wPdLdb3I4TBbwbcs800';
const PAYMENT_LINK_PREMIUM = 'https://buy.stripe.com/test_aFafZh7mP7RwgCjfMrcs801';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Mes données sont-elles vraiment privées ?',
    a: "Oui. L'inférence tourne en Suisse chez Infomaniak, vos données ne sont jamais utilisées pour entraîner des modèles, et chaque compte est strictement isolé des autres.",
  },
  {
    q: 'En quoi est-ce différent de ChatGPT ou Claude ?',
    a: "Le même type d'outil, mais souverain. Lancya est pensé pour les professionnels qui ne peuvent pas confier leurs données clients à des services américains.",
  },
  {
    q: 'Où sont hébergées mes données ?',
    a: "L'intelligence pense déjà en Suisse. Vos données sont hébergées en Europe, avec un objectif clair : tout en Suisse pour la version pro.",
  },
  {
    q: 'Pour quels métiers Lancya est-il conçu ?',
    a: 'Avocats, fiduciaires, médecins, RH, finance, notaires, et tout professionnel soumis au secret ou à des exigences de confidentialité.',
  },
  {
    q: "Quels modèles d'intelligence utilise Lancya ?",
    a: "Les meilleurs modèles open source hébergés en Suisse, ainsi que le modèle suisse Apertus en option pour une souveraineté maximale.",
  },
  {
    q: 'Puis-je annuler à tout moment ?',
    a: 'Oui. Sans engagement, annulation en un clic, à tout moment.',
  },
];

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const isLanding = pathname?.includes('login');

  const plans = [
    {
      name: 'Découverte',
      price: '0',
      tagline: 'Pour essayer Lancya',
      cta: 'Créer un compte',
      href: registerPage(),
      external: false,
      highlighted: false,
      intro: '',
      features: [
        'Rédiger, éditer et créer du contenu',
        'Capacité de rechercher sur le Web',
        'Créer des fichiers et exécuter du code',
        'Intégrer vos outils via des connecteurs MCP',
        'Réflexion approfondie pour les tâches complexes',
      ],
    },
    {
      name: 'Pro',
      price: '17',
      tagline: 'Pour un usage régulier',
      cta: "S'abonner",
      href: PAYMENT_LINK_PRO,
      external: true,
      highlighted: true,
      intro: 'Tout le plan Découverte, plus :',
      features: [
        "Plus d'utilisation*",
        'Mémoire entre les conversations',
        'Accès à tous les modèles',
      ],
    },
    {
      name: 'Premium',
      price: '90',
      tagline: 'Pour un usage intensif',
      cta: "S'abonner",
      href: PAYMENT_LINK_PREMIUM,
      external: true,
      highlighted: false,
      intro: 'Tout le plan Pro, plus :',
      features: [
        "8x plus d'utilisation que la version Pro",
        'Pour un usage intensif au quotidien',
      ],
    },
  ];

  const DisplayError = () => {
    if (hasStartupConfigError) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize('com_auth_error_login_server')}</ErrorMessage>
        </div>
      );
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>
            {localize('com_auth_error_invalid_reset_token')}{' '}
            <a className="font-semibold text-red-600 hover:underline" href="/forgot-password">
              {localize('com_auth_click_here')}
            </a>{' '}
            {localize('com_auth_to_try_again')}
          </ErrorMessage>
        </div>
      );
    } else if (error != null && error) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize(error)}</ErrorMessage>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F9F8F6] text-gray-900 dark:bg-gray-900 dark:text-white">
      <Banner />

      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <BlinkAnimation active={isFetching}>
          <img
            src="assets/logo.svg"
            className="h-8 w-auto"
            alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'Lancya' })}
          />
        </BlinkAnimation>
        <span className="hidden items-center gap-1.5 rounded-full border border-gray-300 bg-white/70 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 sm:inline-flex">
          <span aria-hidden="true">🇨🇭</span> Hébergé en Suisse
        </span>
      </header>

      <div className="absolute bottom-0 left-0 md:m-4">
        <ThemeSelector />
      </div>

      <main className="flex flex-grow flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-2 md:gap-16 md:px-12">
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Votre IA pense
              <br />
              en <span className="text-[#DA291C]">Suisse</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg text-gray-600 dark:text-gray-300">
              {"La puissance d'un ChatGPT ou d'un Claude, mais souverain. Vos données restent en Suisse et ne nourrissent personne."}
            </p>
            <ul className="mt-8 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {[
                'Inférence hébergée en Suisse, chez Infomaniak.',
                'Confidentialité conçue pour les métiers réglementés.',
                'Recherche web, documents et outils, sans quitter la Suisse.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#DA291C]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              {!hasStartupConfigError && !isFetching && header && (
                <h2
                  className="mb-6 text-center text-2xl font-semibold text-black dark:text-white"
                  style={{ userSelect: 'none' }}
                >
                  {header}
                </h2>
              )}
              <DisplayError />
              {children}
              {!pathname.includes('2fa') &&
                (pathname.includes('login') || pathname.includes('register')) && (
                  <SocialLoginRender startupConfig={startupConfig} />
                )}
            </div>
          </div>
        </section>

        {isLanding && (
          <>
            {/* Bandeau metiers */}
            <section className="px-6 py-10 md:px-12">
              <div className="mx-auto max-w-6xl">
                <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Conçu pour les professionnels suisses
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-base font-medium text-gray-500 dark:text-gray-400">
                  {['Avocats', 'Fiduciaires', 'Médecins', 'RH', 'Finance', 'Notaires'].map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* Tarifs */}
            <section className="border-t border-gray-200 bg-white px-6 py-16 dark:border-gray-700 dark:bg-gray-900 md:px-12">
              <div className="mx-auto max-w-6xl">
                <h2 className="text-center text-3xl font-bold tracking-tight">Des offres simples</h2>
                <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                  Sans engagement. Annulation à tout moment.
                </p>
                <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`relative flex flex-col rounded-2xl border p-6 ${
                        plan.highlighted
                          ? 'border-[#DA291C] ring-1 ring-[#DA291C]'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {plan.highlighted && (
                        <span className="absolute -top-3 left-6 rounded-full bg-[#DA291C] px-3 py-1 text-xs font-semibold text-white">
                          Recommandé
                        </span>
                      )}
                      <div className="text-xl font-bold">Lancya {plan.name}</div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {plan.tagline}
                      </div>
                      <div className="mb-5 mt-4">
                        <span className="text-4xl font-bold">{plan.price}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {' '}
                          CHF / mois
                        </span>
                      </div>
                      <a
                        href={plan.href}
                        target={plan.external ? '_blank' : undefined}
                        rel={plan.external ? 'noreferrer' : undefined}
                        className={`block rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                          plan.highlighted
                            ? 'bg-[#DA291C] text-white hover:bg-[#b01f15]'
                            : 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
                        }`}
                      >
                        {plan.cta}
                      </a>
                      {plan.external && (
                        <p className="mt-2 text-center text-xs text-gray-400">
                          Sans engagement · Annulation à tout moment
                        </p>
                      )}
                      <div className="mt-6 flex-grow">
                        {plan.intro && (
                          <p className="mb-3 text-sm font-semibold">{plan.intro}</p>
                        )}
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#DA291C]" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-center text-xs text-gray-400">
                  {"*Limites d'utilisation équitable applicables."}
                </p>
              </div>
            </section>

            {/* FAQ */}
            <section className="px-6 py-16 md:px-12">
              <div className="mx-auto max-w-3xl">
                <h2 className="text-center text-3xl font-bold tracking-tight">
                  Questions fréquentes
                </h2>
                <div className="mt-8 divide-y divide-gray-200 dark:divide-gray-700">
                  {FAQ.map((item) => (
                    <details key={item.q} className="group py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-left text-base font-medium">
                        {item.q}
                        <span className="ml-4 text-xl text-gray-400 transition-transform group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{item.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer startupConfig={startupConfig} />
    </div>
  );
}

export default AuthLayout;
