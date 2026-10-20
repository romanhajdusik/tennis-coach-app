import type { createClient } from "@/lib/supabase/server";
import type { BillingDetails } from "@/lib/stripe";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Fakturačné údaje prihláseného účtu, alebo `null`, keď ich nevyplnil.
 *
 * Číta sa cez RLS (`billing_details_select_own`), takže cudzí riadok to
 * nevráti, ani keby volajúci podal cudzie `userId`.
 */
export async function getBillingDetails(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<BillingDetails | null> {
  const { data } = await supabase
    .from("billing_details")
    .select("company, address, company_id, tax_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    company: data.company,
    address: data.address,
    companyId: data.company_id,
    taxId: data.tax_id,
  };
}
