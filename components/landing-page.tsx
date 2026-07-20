import Link from "next/link";
import { cookies } from "next/headers";
import {
  defaultLandingLocale,
  isValidLandingLocale,
  loadLandingMessages,
} from "@/lib/landing-locale";
import { LandingLanguageSwitcher } from "@/components/landing-language-switcher";
import {
  CalendarIcon,
  ChartBarIcon,
  ClipboardCheckIcon,
  DeviceMobileIcon,
  TagIcon,
  UsersIcon,
} from "@/components/landing-icons";

const FEATURE_ICONS = [
  CalendarIcon,
  ClipboardCheckIcon,
  TagIcon,
  ChartBarIcon,
  UsersIcon,
  DeviceMobileIcon,
];

export async function getLandingLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("LANDING_LOCALE")?.value;
  return isValidLandingLocale(cookieLocale) ? cookieLocale : defaultLandingLocale;
}

export async function LandingPage() {
  const locale = await getLandingLocale();
  const t = await loadLandingMessages(locale);

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-white dark:bg-black">
      {/* Dekoratívne rozmazané pozadie za hero sekciou */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-green-400/25 blur-3xl dark:bg-green-500/10" />
        <div className="absolute right-[-120px] top-[80px] h-[320px] w-[320px] rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-black/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
              P
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                P.L.A.W
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:block dark:text-zinc-500">
                Plan · Log · Analyze · Win
              </span>
            </span>
          </span>
          <div className="flex items-center gap-3">
            <LandingLanguageSwitcher currentLocale={locale} />
            <Link
              href="/login"
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 ring-1 ring-green-600/10 dark:bg-green-900/40 dark:text-green-300">
          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
          {t.eyebrow}
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-balance text-zinc-900 sm:text-5xl dark:text-zinc-50">
          {t.heroTitle}
        </h1>
        <p className="max-w-xl text-base text-balance text-zinc-600 sm:text-lg dark:text-zinc-400">
          {t.heroSubtitle}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/register"
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-600/25 transition hover:bg-green-700 hover:shadow-green-600/35"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </section>

      <section className="w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          {t.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-50">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-8 text-center dark:border-zinc-800 dark:from-zinc-950 dark:to-black">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
            {t.pricingBadge}
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t.pricingTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            {t.pricingText}
          </p>
          <Link
            href="/register"
            className="mt-5 inline-block rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-600/25 transition hover:bg-green-700"
          >
            {t.pricingCta}
          </Link>
        </div>
      </section>

      <section className="relative mt-6 w-full overflow-hidden bg-zinc-950 py-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-600/20 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {t.finalCtaTitle}
          </h2>
          <p className="text-sm text-zinc-300">{t.finalCtaSubtitle}</p>
          <Link
            href="/register"
            className="mt-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
          >
            {t.finalCtaButton}
          </Link>
        </div>
      </section>

      <footer className="w-full max-w-5xl px-4 py-8 text-center text-xs text-zinc-500 sm:px-6 dark:text-zinc-500">
        {t.footerTagline}
      </footer>
    </div>
  );
}
