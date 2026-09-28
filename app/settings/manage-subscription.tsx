"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { openBillingPortal } from "@/lib/actions/subscription";

/**
 * Tlačidlo do zákazníckeho portálu Stripe — tam si tréner sám zmení kartu,
 * prejde na inú hladinu alebo predplatné **zruší**.
 *
 * Klientský je preto, že adresu portálu treba otvoriť úplným načítaním
 * (je to cudzia doména) a relácia sa zakladá až pri kliknutí — vopred by
 * vypršala.
 */
export function ManageSubscription() {
  const t = useTranslations("Settings");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await openBillingPortal();
            if ("url" in result) {
              window.location.assign(result.url);
              return;
            }
            setError(result.error);
          });
        }}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? t("billingOpening") : t("billingButton")}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {t(`billingErrors.${error}` as "billingErrors.unavailable")}
        </p>
      )}
    </div>
  );
}
