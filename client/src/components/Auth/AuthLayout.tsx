import { ThemeSelector } from '@librechat/client';
import { TStartupConfig } from 'librechat-data-provider';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

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
    <div className="relative flex min-h-screen flex-col bg-[#faf8f5] text-gray-900 dark:bg-gray-900 dark:text-white">
      <Banner />

      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <BlinkAnimation active={isFetching}>
          <img
            src="assets/logo.svg"
            className="h-7 w-auto"
            alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? 'Lancya' })}
          />
        </BlinkAnimation>
        <span className="hidden items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 sm:flex">
          <span className="inline-block h-3 w-3 rounded-[2px] bg-[#DA291C]" />
          Hébergé en Suisse
        </span>
      </header>

      <div className="absolute bottom-0 left-0 md:m-4">
        <ThemeSelector />
      </div>

      <main className="flex flex-grow flex-col">
        <section className="mx-auto grid w-full max-w-6xl flex-grow grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-2 md:gap-16 md:px-12">
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Votre IA pense
              <br />
              en <span className="text-[#DA291C]">Suisse</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg text-gray-600 dark:text-gray-300">
              L&apos;espace de travail IA souverain pour les professionnels. Vos
              données restent en Suisse et ne nourrissent personne.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#DA291C]" />
                Inférence hébergée en Suisse, chez Infomaniak.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#DA291C]" />
                Confidentialité pensée pour les métiers réglementés.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#DA291C]" />
                Recherche web, documents et outils, sans quitter la Suisse.
              </li>
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

        <section className="border-t border-gray-200 bg-white px-6 py-12 dark:border-gray-700 dark:bg-gray-900 md:px-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
              Conçu pour les professionnels suisses
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-base font-medium text-gray-500 dark:text-gray-400">
              <span>Avocats</span>
              <span>Fiduciaires</span>
              <span>Médecins</span>
              <span>RH</span>
              <span>Finance</span>
              <span>Notaires</span>
            </div>
          </div>
        </section>
      </main>

      <Footer startupConfig={startupConfig} />
    </div>
  );
}

export default AuthLayout;
