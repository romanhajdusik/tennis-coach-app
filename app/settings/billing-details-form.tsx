"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveBillingDetails } from "@/lib/actions/billing-details";
import type { BillingDetails } from "@/lib/stripe";

const FIELDS = [
  { name: "company", key: "company", autoComplete: "organization" },
  { name: "address", key: "address", autoComplete: "street-address" },
  { name: "company_id", key: "companyId", autoComplete: "off" },
  { name: "tax_id", key: "taxId", autoComplete: "off" },
] as const;

/**
 * Fakturačné údaje — čo sa vyplní, Stripe vytlačí na faktúru (`lib/stripe.ts`,
 * `billingCustomFields`).
 *
 * Pole na IČ DPH tu zámerne NIE JE a formulár to hovorí natvrdo: IČ DPH mení
 * daňový režim platby, pýta sa naň pokladňa a neplatiteľ DPH ho vyplniť
 * nesmie — a práve on by vyplnil všetky políčka „pre poriadok".
 */
export function BillingDetailsForm({
  details,
}: {
  details: BillingDetails | null;
}) {
  const t = useTranslations("Settings.billingDetails");
  const [state, formAction, pending] = useActionState(
    saveBillingDetails,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {FIELDS.map((field) => (
        <div key={field.name} className="flex flex-col gap-1">
          <label
            htmlFor={`billing-${field.name}`}
            className="text-sm font-medium text-foreground"
          >
            {t(`labels.${field.key}`)}
          </label>
          <input
            id={`billing-${field.name}`}
            name={field.name}
            type="text"
            maxLength={140}
            autoComplete={field.autoComplete}
            defaultValue={details?.[field.key] ?? ""}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
          />
        </div>
      ))}
      <p className="text-xs text-muted">{t("vatHint")}</p>
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-300">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state && "saved" in state && (
        <p role="status" className="text-sm text-green-300">
          {t("saved")}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
