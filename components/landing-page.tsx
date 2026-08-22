import Link from "next/link";
import { cookies } from "next/headers";
import {
  defaultLandingLocale,
  isValidLandingLocale,
  loadLandingMessages,
} from "@/lib/landing-locale";
import { LandingLanguageSwitcher } from "@/components/landing-language-switcher";
import { LandingPricing } from "@/components/landing-pricing";
import {
  COACH_TIERS,
  centsPerPlayerDay,
  formatEur,
} from "@/lib/landing-pricing";
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

// Reálne mobilné screenshoty appky (v poradí plán → záznam → analýza).
// Appka samotná je len SK/EN, takže existujú dve sady záberov: slovenská
// (public/screenshots/sk) a anglická (public/screenshots/en). Slovenský
// landing ukazuje slovenské zábery, všetky ostatné jazyky (EN/DE/ES/RU/FR)
// anglické — angličtina je univerzálnejší fallback než slovenčina. Popisky
// pod zábermi sú preložené do každého jazyka (showcaseCaptions).
const SHOWCASE = ["calendar", "session", "analytics"] as const;

export async function getLandingLocale() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("LANDING_LOCALE")?.value;
  return isValidLandingLocale(cookieLocale) ? cookieLocale : defaultLandingLocale;
}

export async function LandingPage() {
  const locale = await getLandingLocale();
  const t = await loadLandingMessages(locale);
  // Appka je len SK/EN — slovenský landing dostane slovenské zábery,
  // ostatné jazyky anglické.
  const shotLocale = locale === "sk" ? "sk" : "en";
  // Ceny formátuje server podľa jazyka (6,90 € vs €6.90) — v prehliadači sa
  // prepína len obdobie. Počet hráčov je preložený reťazec, lebo pluralita
  // („3 hráči" vs „6 hráčov") je vec jazyka, nie čísla.
  const tiers = COACH_TIERS.map((tier, index) => ({
    players: t.pricingPlayerCounts[index],
    monthly: formatEur(locale, tier.monthly),
    yearly: formatEur(locale, tier.yearly),
    yearlyPerMonth: formatEur(locale, tier.yearly / 12),
    monthlyYearTotal: formatEur(locale, tier.monthly * 12),
    centsMonthly: centsPerPlayerDay(locale, tier.monthly * 12, tier.players),
    centsYearly: centsPerPlayerDay(locale, tier.yearly, tier.players),
    featured: tier.featured === true,
  }));

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      {/* Dekoratívne rozmazané pozadie za hero sekciou (antukový nádych) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-120px] top-[80px] h-[320px] w-[320px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="rounded-md bg-[#eef0f0] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/plaw-logo.webp"
              alt="P.L.A.W — Plan. Log. Analyze. Win."
              className="block h-7 w-auto"
            />
          </span>
          <div className="flex items-center gap-3">
            <LandingLanguageSwitcher currentLocale={locale} />
            <Link
              href="/login"
              className="hidden text-sm font-medium text-muted transition-colors hover:text-foreground sm:inline"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
        <span className="rounded-2xl border border-border bg-[#eef0f0] p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plaw-logo.webp"
            alt="P.L.A.W — Plan. Log. Analyze. Win. Timing for progress. plaw.win"
            className="block h-auto w-full max-w-[260px] sm:max-w-[340px]"
          />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t.eyebrow}
        </span>
        {t.heroPoints?.length ? (
          // Prvé heslo je h1, zvyšné dve h2 — hierarchia stránky tak ostáva
          // zmysluplná aj pre čítačku obrazovky a nič sa needuplikuje.
          <div className="flex w-full flex-col gap-6 pt-1 text-left sm:gap-7">
            {t.heroPoints.map((point, index) => (
              <div key={point.title} className="flex flex-col gap-1.5">
                {index === 0 ? (
                  <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl">
                    {point.title}
                  </h1>
                ) : (
                  <h2 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl">
                    {point.title}
                  </h2>
                )}
                <p className="text-base text-balance text-muted sm:text-lg">
                  {point.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-tight text-balance text-foreground sm:text-5xl">
              {t.heroTitle}
            </h1>
            <p className="max-w-xl text-base text-balance text-muted sm:text-lg">
              {t.heroSubtitle}
            </p>
          </>
        )}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/register"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
          >
            {t.ctaSecondary}
          </Link>
        </div>
        <div className="flex w-full flex-col justify-center gap-3 pt-1 sm:flex-row">
          <Link
            href="/navod"
            className="rounded-lg border border-border bg-surface px-5 py-2.5 text-center text-sm font-medium text-foreground transition hover:border-primary/50"
          >
            {t.guideCoach}
          </Link>
          <Link
            href="/navod-hrac"
            className="rounded-lg border border-border bg-surface px-5 py-2.5 text-center text-sm font-medium text-foreground transition hover:border-primary/50"
          >
            {t.guidePlayer}
          </Link>
        </div>
      </section>

      <section className="w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.showcaseTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-balance text-muted">
          {t.showcaseSubtitle}
        </p>
        <div className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:flex-wrap md:justify-center md:overflow-visible md:pb-0">
          {SHOWCASE.map((key) => (
            <figure
              key={key}
              className="flex shrink-0 snap-center flex-col items-center gap-3"
            >
              <div className="w-[220px] rounded-[2rem] bg-input p-2.5 shadow-2xl ring-1 ring-border transition hover:-translate-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/screenshots/${shotLocale}/${key}.webp`}
                  alt={t.showcaseCaptions[key]}
                  width={640}
                  height={1385}
                  loading="lazy"
                  className="block w-full rounded-[1.5rem]"
                />
              </div>
              <figcaption className="max-w-[220px] text-center text-sm text-muted">
                {t.showcaseCaptions[key]}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Argument, ktorý tréner používa v rozhovore s rodičom — preto je to
          citát, nie ďalšia dlaždica funkcie. Texty existujú len v SK a EN,
          takže sa sekcia inde nevykreslí. */}
      {t.transparencyTitle && t.transparencyQuote ? (
        <section className="w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
            {t.transparencyTitle}
          </h2>
          {t.transparencyIntro ? (
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
              {t.transparencyIntro}
            </p>
          ) : null}
          <blockquote className="mt-6 rounded-2xl border border-border border-l-4 border-l-primary bg-surface p-5 text-base leading-relaxed text-foreground sm:p-6">
            {t.transparencyQuote}
          </blockquote>
          {t.transparencyNote ? (
            <p className="mx-auto mt-4 max-w-xl text-center text-sm text-balance text-muted">
              {t.transparencyNote}
            </p>
          ) : null}
        </section>
      ) : null}

      <section
        id="cennik"
        className="w-full max-w-5xl scroll-mt-20 px-4 py-8 sm:px-6 sm:py-12"
      >
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.pricingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-balance text-muted">
          {t.pricingSubtitle}
        </p>
        <LandingPricing
          tiers={tiers}
          labels={{
            monthly: t.pricingMonthly,
            yearly: t.pricingYearly,
            yearlySave: t.pricingYearlySave,
            perMonth: t.pricingPerMonth,
            monthlyYearTotal: t.pricingMonthlyYearTotal,
            perYear: t.pricingPerYear,
            yearlyNote: t.pricingYearlyNote,
            perDay: t.pricingPerDay,
            recommended: t.pricingRecommended,
            compareTitle: t.pricingCompareTitle,
            compareWithoutSub: t.pricingCompareWithoutSub,
            comparePaid: t.pricingComparePaid,
            compareRows: t.pricingCompareRows,
            compareNote: t.pricingCompareNote,
            vat: t.pricingVat,
            followerText: t.pricingFollowerText,
            followerCta: t.pricingFollowerCta,
            cta: t.pricingCta,
          }}
        />
      </section>

      <section className="relative mt-6 w-full overflow-hidden bg-primary py-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
            {t.finalCtaTitle}
          </h2>
          <p className="text-sm text-primary-foreground/80">{t.finalCtaSubtitle}</p>
          <Link
            href="/register"
            className="mt-2 rounded-lg bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary transition hover:opacity-90"
          >
            {t.finalCtaButton}
          </Link>
        </div>
      </section>

      <footer className="w-full max-w-5xl px-4 py-8 text-center text-xs text-muted sm:px-6">
        {t.footerTagline}
      </footer>
    </div>
  );
}
