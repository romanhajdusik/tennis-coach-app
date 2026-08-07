import Link from "next/link";
import type { Metadata } from "next";
import { loadFederacieMessages } from "@/lib/landing-locale";
import {
  ChartBarIcon,
  ClipboardCheckIcon,
  DeviceMobileIcon,
  GlobeIcon,
  TagIcon,
  UsersIcon,
} from "@/components/landing-icons";

/**
 * Verejná stránka o federačnom (B2B) režime — informačná, **bez prihlásenia
 * a bez výzvy na akciu**: organizácia sa nezakladá samoobslužne, robí sa to
 * ručne (docs/onboarding-organizacie.md), takže tlačidlo „registrovať" by
 * viedlo do prázdna.
 *
 * Žije **len na plaw.online** (verejná tvár) — `proxy.ts` ju tam púšťa cez
 * PUBLIC_PATHS a na plaw.win ju presmeruje sem, aby mala jedinú adresu.
 *
 * Je zámerne **len po slovensky** (prví B2B zákazníci sú slovenské zväzy
 * a kluby), preto nemá prepínač jazykov ako landing a návody. Zvyšok vzhľadu
 * je zhodný s nimi — antuková tmavá téma cez tokeny.
 */
// Poradie sedí s `features` v messages/sk/federacie.json — každá dlaždica má
// vlastnú ikonu, žiadna sa neopakuje.
const FEATURE_ICONS = [
  ClipboardCheckIcon,
  ChartBarIcon,
  UsersIcon,
  TagIcon,
  GlobeIcon,
  DeviceMobileIcon,
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await loadFederacieMessages();
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    // Noindex ako zvyšok verejného webu, kým nie je spustený naostro.
    robots: { index: false, follow: false },
  };
}

export default async function FederaciePage() {
  const t = await loadFederacieMessages();

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      {/* Dekoratívne rozmazané pozadie za hlavičkou (antukový nádych) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-170px] h-[460px] w-[780px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
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
          <Link
            href="/"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            {t.backToHome}
          </Link>
        </div>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 pb-12 pt-14 text-center sm:px-6 sm:pb-16 sm:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t.eyebrow}
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-balance text-foreground sm:text-5xl">
          {t.title}
        </h1>
        <p className="max-w-xl text-base text-balance text-muted sm:text-lg">
          {t.subtitle}
        </p>
      </section>

      <section className="w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
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

      <section className="w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.howTitle}
        </h2>
        <ol className="flex flex-col gap-4">
          {t.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-border bg-surface p-5"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted">
                  {t.stepWord} {index + 1}
                </span>
                <h3 className="mt-0.5 font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t.notesTitle}
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {t.notes.map((note) => (
              <li key={note} className="flex gap-2.5 text-sm text-muted">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary"
                />
                <span className="leading-relaxed">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-border">
            {t.pricingBadge}
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            {t.pricingTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {t.pricingText}
          </p>
        </div>
      </section>

      <footer className="w-full max-w-5xl px-4 py-8 text-center text-xs text-muted sm:px-6">
        {t.footerTagline}
      </footer>
    </div>
  );
}
