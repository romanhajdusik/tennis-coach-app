import Link from "next/link";
import type { Metadata } from "next";
import { getLandingLocale } from "@/components/landing-page";
import { loadNavodMessages } from "@/lib/landing-locale";
import { LandingLanguageSwitcher } from "@/components/landing-language-switcher";

// Návod je verejná stránka (súčasť plaw.online popri landingu) — používa tú
// istú jazykovú vrstvu ako landing (LANDING_LOCALE, 6 jazykov), nie appkové
// next-intl. Zámerne noindex, kým appka nie je verejne spustená (rovnako ako
// landing, pozri app/page.tsx). Farby: antuková tmavá téma ako appka.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLandingLocale();
  const t = await loadNavodMessages(locale);
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default async function NavodPage() {
  const locale = await getLandingLocale();
  const t = await loadNavodMessages(locale);

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      {/* Dekoratívne rozmazané pozadie za hlavičkou (antukový nádych) */}
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

      <section className="flex w-full max-w-3xl flex-col items-center gap-5 px-4 pb-10 pt-14 text-center sm:px-6 sm:pb-14 sm:pt-20">
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

      <section className="w-full max-w-3xl px-4 pb-4 sm:px-6">
        <ol className="flex flex-col gap-4">
          {t.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-md sm:gap-5 sm:p-6"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted">
                  {t.stepWord} {index + 1}
                </div>
                <h2 className="mb-1.5 font-semibold text-foreground">
                  {step.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-7">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
            {t.tipsTitle}
          </h2>
          <ul className="flex flex-col gap-3">
            {t.tips.map((tip) => (
              <li key={tip} className="flex gap-2.5 text-sm text-muted">
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
                <span>{tip}</span>
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
            href="/register"
            className="mt-2 rounded-lg bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary transition hover:opacity-90"
          >
            {t.ctaButton}
          </Link>
        </div>
      </section>
    </div>
  );
}
