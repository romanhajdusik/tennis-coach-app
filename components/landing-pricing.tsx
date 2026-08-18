"use client";

import { useState } from "react";
import Link from "next/link";

// Cenník na landing page. Klientský komponent je tu len kvôli prepínaču
// mesačne/ročne — samotné ceny prídu už naformátované zo servera
// (`lib/landing-pricing.ts` + Intl podľa jazyka), aby sa čísla nerozišli
// s dokumentom a aby sa v prehliadači nepočítalo nič, čo sa dá vypočítať
// dopredu.

export type PricingTierView = {
  /** Preložený štítok počtu hráčov („3 hráči") — pluralita je vec jazyka. */
  players: string;
  monthly: string;
  yearly: string;
  /** Ročná cena rozpočítaná na mesiac — hlavný argument ročnej platby. */
  yearlyPerMonth: string;
  centsMonthly: string;
  centsYearly: string;
  featured: boolean;
};

export type PricingLabels = {
  monthly: string;
  yearly: string;
  yearlySave: string;
  perMonth: string;
  perYear: string;
  yearlyNote: string;
  perDay: string;
  recommended: string;
  includedTitle: string;
  included: string[];
  moreTitle: string;
  moreText: string;
  moreCta: string;
  vat: string;
  followerText: string;
  followerCta: string;
  cta: string;
};

type Period = "monthly" | "yearly";

function fill(template: string, amount: string) {
  return template.replace("{amount}", amount);
}

export function LandingPricing({
  tiers,
  labels,
  contactEmail,
}: {
  tiers: PricingTierView[];
  labels: PricingLabels;
  contactEmail: string;
}) {
  // Ročná platba je predvolená: je to výhodnejšia voľba pre obe strany
  // (hotovosť dopredu, nižšia cena) a pri nej platí veta „od 4 centov na deň".
  const [period, setPeriod] = useState<Period>("yearly");
  const yearly = period === "yearly";

  return (
    <>
      <div className="mt-6 flex justify-center">
        <div
          role="group"
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1"
        >
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                period === value
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {value === "monthly" ? labels.monthly : labels.yearly}
              {value === "yearly" ? (
                <span
                  className={`ml-1.5 text-xs ${
                    period === value ? "opacity-90" : "text-primary"
                  }`}
                >
                  {labels.yearlySave}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.players}
            className={`relative flex flex-col rounded-2xl border bg-surface p-5 transition ${
              tier.featured
                ? "border-primary/60 shadow-lg shadow-primary/10"
                : "border-border hover:border-primary/40"
            }`}
          >
            {tier.featured ? (
              <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                {labels.recommended}
              </span>
            ) : null}
            <div className="text-sm font-medium text-foreground">
              {tier.players}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {yearly ? tier.yearly : tier.monthly}
              </span>
              <span className="text-sm text-muted">
                {yearly ? labels.perYear : labels.perMonth}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {yearly
                ? fill(labels.yearlyNote, tier.yearlyPerMonth)
                : fill(labels.perDay, tier.centsMonthly)}
            </p>
            {yearly ? (
              <p className="mt-1 text-sm text-muted">
                {fill(labels.perDay, tier.centsYearly)}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Tréner so skupinami má bežne 15–25 hráčov a federačný produkt preňho
          nie je. Štvrtá hladina by bola rozhodnutie navyše — dlaždica s adresou
          nič nestojí a rovno ukáže, či taký dopyt existuje (docs §3). */}
      <div className="mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface/60 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h3 className="font-semibold text-foreground">{labels.moreTitle}</h3>
          <p className="mt-0.5 text-sm text-muted">{labels.moreText}</p>
        </div>
        <a
          href={`mailto:${contactEmail}`}
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-surface"
        >
          {labels.moreCta}
        </a>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {labels.includedTitle}
        </h3>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {labels.included.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-muted">
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
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <Link
          href="/register"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover"
        >
          {labels.cta}
        </Link>
        <p className="text-xs text-muted">{labels.vat}</p>
        <p className="text-sm text-muted">
          {labels.followerText}{" "}
          <Link
            href="/cennik-hrac"
            className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-muted"
          >
            {labels.followerCta}
          </Link>
        </p>
      </div>
    </>
  );
}
