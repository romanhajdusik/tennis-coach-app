"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { startCheckout } from "@/lib/actions/subscription";
import type { BillingInterval } from "@/lib/stripe-plans";

export type FollowerPlan = {
  /** Už naformátované sumy — čísla prídu zo servera, klient ich nepočíta. */
  price: Record<BillingInterval, string>;
  lookupKey: Record<BillingInterval, string>;
  /** Koľko centov denne vyjde ročná platba. Dopočítané na serveri. */
  centsPerDay: string;
};

/**
 * Výber obdobia a vstup do pokladne pre sledujúceho.
 *
 * Je to samostatný komponent, nie `PlanPicker` s jedným plánom: tréner si
 * vyberá HLADINU (koľko hráčov), sledujúci len OBDOBIE. Natlačiť oboje do
 * jedného komponentu by znamenalo vetvenie v každom riadku.
 *
 * Klientský je z rovnakého dôvodu ako trénerský — kvôli prepínaču a kvôli
 * tomu, že adresu pokladne treba otvoriť úplným načítaním stránky.
 */
export function FollowerPlanPicker({ plan }: { plan: FollowerPlan }) {
  const t = useTranslations("Subscribe");
  // Predvolene ročne, rovnako ako cenník na webe.
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function subscribe() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout(plan.lookupKey[interval]);
      if ("url" in result) {
        // Úplné načítanie, nie router — pokladňa je cudzia doména.
        window.location.assign(result.url);
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label={t("monthly") + " / " + t("yearly")}
        className="flex gap-2"
      >
        {(["year", "month"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setInterval(option)}
            aria-pressed={interval === option}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              interval === option
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {option === "year" ? t("yearly") : t("monthly")}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-primary bg-surface p-5">
        <p className="text-3xl font-bold text-foreground">
          {plan.price[interval]}
          <span className="ml-2 text-sm font-normal text-muted">
            {interval === "year" ? t("perYear") : t("perMonth")}
          </span>
        </p>
        {interval === "year" && (
          <p className="text-sm text-muted">
            {t("follower.perDay", { amount: plan.centsPerDay })}
          </p>
        )}
        <p className="text-xs text-muted">{t("vat")}</p>
      </div>

      <button
        type="button"
        onClick={subscribe}
        disabled={pending}
        className="rounded-full bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? t("opening") : t("cta")}
      </button>

      {error && (
        <p className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          {t(`errors.${error}` as "errors.unavailable")}
        </p>
      )}
    </div>
  );
}
