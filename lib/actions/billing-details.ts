"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isStripeConfigured,
  updateCustomerBillingDetails,
  type BillingDetails,
} from "@/lib/stripe";

export type BillingDetailsFormState =
  | { error: "tooLong" | "saveFailed" | "notSynced" }
  | { saved: true }
  | undefined;

/** Strop jednej hodnoty — Stripe na faktúre berie najviac 140 znakov. */
const MAX_LENGTH = 140;

function field(formData: FormData, name: string) {
  const value = (formData.get(name) as string | null)?.trim() ?? "";
  return value === "" ? null : value;
}

/**
 * Uloženie fakturačných údajov (firma, adresa, IČO, DIČ).
 *
 * **Bez `requireWriteAccess` zámerne:** údaje sú potrebné práve na to, aby si
 * účet predplatné kúpil — stráž predplatného by ich zamkla presne tomu, kto
 * ich potrebuje. Účet si nimi nič neodomkne, len si upraví vlastnú faktúru.
 *
 * Kto už v Stripe zákazníka má (`stripe_customer_id`, zapisuje ho webhook),
 * tomu sa údaje prepíšu aj tam a platia od ďalšej faktúry. Kto ešte neplatil,
 * tomu ich do Stripe pošle až pokladňa (`startCheckout`).
 */
export async function saveBillingDetails(
  _prevState: BillingDetailsFormState,
  formData: FormData,
): Promise<BillingDetailsFormState> {
  const details: BillingDetails = {
    company: field(formData, "company"),
    address: field(formData, "address"),
    companyId: field(formData, "company_id"),
    taxId: field(formData, "tax_id"),
  };

  if (Object.values(details).some((value) => (value?.length ?? 0) > MAX_LENGTH)) {
    return { error: "tooLong" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("billing_details").upsert({
    user_id: user.id,
    company: details.company,
    address: details.address,
    company_id: details.companyId,
    tax_id: details.taxId,
  });

  if (error) {
    console.error("Fakturačné údaje sa nedali uložiť:", error.message);
    return { error: "saveFailed" };
  }

  revalidatePath("/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.stripe_customer_id && isStripeConfigured()) {
    try {
      await updateCustomerBillingDetails(profile.stripe_customer_id, details);
    } catch (stripeError) {
      // U nás sú uložené, len Stripe ich nemá — ďalšia faktúra by vyšla bez
      // nich. Používateľ to musí vedieť, inak by sa spoľahol na uloženie.
      console.error("Stripe: fakturačné údaje sa nedali prepísať:", stripeError);
      return { error: "notSynced" };
    }
  }

  return { saved: true };
}
