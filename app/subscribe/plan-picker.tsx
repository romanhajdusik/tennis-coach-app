"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { startCheckout } from "@/lib/actions/subscription";
import type { BillingInterval } from "@/lib/stripe-plans";

export type PlanOption = {
  players: number;
  featured: boolean;
  /** Už naformátovaná suma — čísla prídu zo servera, klient ich nepočíta. */
  price: Record<BillingInterval, string>;
  lookupKey: Record<BillingInterval, string>;
};

/**
 * Výber cenovej hladiny a otvorenie pokladne.
 *
 * Klientský je **len kvôli prepínaču** mesačne/ročne a kvôli tomu, že adresu
 * pokladne treba otvoriť úplným načítaním stránky (`window.location.assign`).
 * Sumy sa sem dostávajú naformátované zo servera — rovnako ako v cenníku na
 * landingu.
 */
export function PlanPicker({ plans }: { plans: PlanOption[] }) {
  const t = useTranslations("Subscribe");
  // Predvolene ročne, rovnako ako cenník na landingu — je to výhodnejšia
  // voľba a tréner ju má vidieť prvú.
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function subscribe(lookupKey: string) {
    setError(null);
    startTransition(async () => {
      const result = await startCheckout(lookupKey);
      if ("url" in result) {
        // Úplné načítanie, nie router — pokladňa je cudzia doména.
        window.location.assign(result.url);
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="group"
        className="flex w-full rounded-xl border border-border bg-input p-1 text-sm"
      >
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            aria-pressed={interval === value}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${
              interval === value
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {value === "month" ? t("monthly") : t("yearly")}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted">
        {interval === "year" ? t("yearlySaving") : t("vat")}
      </p>

      {plans.map((plan) => (
        <div
          key={plan.players}
          className={`flex flex-col gap-3 rounded-2xl border bg-surface p-5 ${
            plan.featured ? "border-primary" : "border-border"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold text-foreground">
              {t("players", { count: plan.players })}
            </span>
            <span className="text-right">
              <span className="text-xl font-bold text-foreground">
                {plan.price[interval]}
              </span>{" "}
              <span className="text-xs text-muted">
                {interval === "month" ? t("perMonth") : t("perYear")}
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => subscribe(plan.lookupKey[interval])}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? t("opening") : t("cta")}
          </button>
        </div>
      ))}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-950 px-4 py-2.5 text-sm text-red-200"
        >
          {t(`errors.${error}` as "errors.unavailable")}
        </p>
      )}
    </div>
  );
}
