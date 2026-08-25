import Link from "next/link";
import type { Metadata } from "next";
import { getLandingLocale } from "@/components/landing-page";
import { loadCennikHracMessages } from "@/lib/landing-locale";
import { LandingLanguageSwitcher } from "@/components/landing-language-switcher";
import { CompareMark } from "@/components/compare-mark";
import {
  FOLLOWER_PRICE,
  centsPerPlayerDay,
  formatEur,
} from "@/lib/landing-pricing";

// Cenník pre hráča, rodiča a manažéra. Zámerne SAMOSTATNÁ stránka, nie sekcia
// landingu — dôvod je pri type správ v `lib/landing-locale.ts`.
//
// Ktoré riadky tabuľky platia aj BEZ predplatného. Poradie sedí s
// `compareRows` v prekladoch a s modelom v `docs/cennik-navrh.md` §8.3:
// zoznam tréningov (s filtrom na mesiac), detail a uchovanie histórie sú
// dostupné vždy, KALENDÁR a ANALYTIKA sú za platbou. Zadarmo teda ostáva
// odpoveď na otázku „čo dieťa trénovalo", za platbu ide pohodlie a prehľad.
//
// **Appka to zatiaľ nevynucuje** — stráže na `app/parent/calendar` a
// `app/parent/analytics/**` sa stavajú so Stripe. Keď sa budú stavať, musia
// sedieť s týmto poľom, inak stránka sľubuje niečo iné, než appka robí.
const WITHOUT_SUBSCRIPTION = [true, true, true, false, false];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const locale = await getLandingLocale((await searchParams).lang);
  const t = await loadCennikHracMessages(locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default async function CennikHracPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = await getLandingLocale((await searchParams).lang);
  const t = await loadCennikHracMessages(locale);

  const yearly = formatEur(locale, FOLLOWER_PRICE.yearly);
  const monthly = formatEur(locale, FOLLOWER_PRICE.monthly);
  const monthlyYearTotal = formatEur(locale, FOLLOWER_PRICE.monthly * 12);
  const cents = centsPerPlayerDay(locale, FOLLOWER_PRICE.yearly, 1);

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="rounded-md bg-[#eef0f0] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/plaw-logo.webp"
              alt="P.L.A.W — Plan. Log. Analyze. Win."
              className="block h-7 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3">
            <LandingLanguageSwitcher currentLocale={locale} />
            <Link
              href="/"
              className="hidden text-sm font-medium text-muted transition-colors hover:text-foreground sm:inline"
            >
              {t.backToHome}
            </Link>
          </div>
        </div>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 pb-10 pt-14 text-center sm:px-6 sm:pb-12 sm:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t.eyebrow}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
          {t.title}
        </h1>
        <p className="max-w-xl text-base text-balance text-muted sm:text-lg">
          {t.subtitle}
        </p>
      </section>

      {/* Ročná cena je hlavná a tak sa aj komunikuje („pod 10 centov na deň").
          Mesačná tu nie je preto, aby ju niekto bral, ale aby bola ročná
          zjavne výhodná a aby mal kam siahnuť ten, kto sa nechce zaviazať. */}
      <section className="w-full max-w-3xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="rounded-2xl border border-primary/60 bg-surface p-6 shadow-lg shadow-primary/10 sm:col-span-3">
            <div className="text-sm font-medium text-foreground">
              {t.yearlyLabel}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-foreground">
                {yearly}
              </span>
              <span className="text-sm text-muted">{t.perYear}</span>
            </div>
            <p className="mt-2 text-sm text-foreground">
              {t.perDay.replace("{amount}", cents)}
            </p>
            <p className="mt-1 text-sm text-muted">{t.yearlyNote}</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 sm:col-span-2">
            <div className="text-sm font-medium text-foreground">
              {t.monthlyLabel}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {monthly}
              </span>
              <span className="text-sm text-muted">{t.perMonth}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {t.monthlyYearTotal.replace("{amount}", monthlyYearTotal)}
            </p>
            <p className="mt-2 text-sm text-muted">{t.trialNote}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted">{t.vat}</p>
      </section>

      <section className="w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
          {t.compareTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-balance text-muted">
          {t.compareSubtitle}
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-x-3 border-b border-border px-4 py-3 text-xs font-medium leading-tight text-muted sm:gap-x-6 sm:px-6">
            <span />
            <span className="w-20 hyphens-auto break-words text-center sm:w-28">
              {t.compareWithoutSub}
            </span>
            <span className="w-20 hyphens-auto break-words text-center sm:w-28">
              {t.comparePaid}
            </span>
          </div>
          {t.compareRows.map((row, index) => (
            <div
              key={row}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-border/60 px-4 py-3.5 last:border-b-0 sm:gap-x-6 sm:px-6"
            >
              <span className="text-sm text-foreground">{row}</span>
              <span className="flex w-20 justify-center sm:w-28">
                <CompareMark ok={WITHOUT_SUBSCRIPTION[index] === true} />
              </span>
              <span className="flex w-20 justify-center sm:w-28">
                <CompareMark ok />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-3xl px-4 pb-10 sm:px-6 sm:pb-14">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-7">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
            {t.notesTitle}
          </h2>
          <ul className="flex flex-col gap-3">
            {t.notes.map((note) => (
              <li key={note} className="flex gap-2.5 text-sm text-muted">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 0 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative mt-2 w-full overflow-hidden bg-primary py-14 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
            {t.ctaTitle}
          </h2>
          <p className="text-sm text-primary-foreground/80">{t.ctaText}</p>
          <Link
            href="/parent/login"
            className="mt-2 rounded-lg bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary transition hover:opacity-90"
          >
            {t.ctaButton}
          </Link>
        </div>
      </section>

      <div className="w-full max-w-3xl px-4 py-6 text-center text-sm text-muted sm:px-6">
        {t.crossLinkText}{" "}
        <Link
          href="/navod-hrac"
          className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-muted"
        >
          {t.crossLinkCta}
        </Link>
      </div>
    </div>
  );
}
