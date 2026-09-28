import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Klient so `service_role` — **obchádza RLS a smie zapisovať do cudzích
 * riadkov**. Je to jediné miesto v celej appke, kde taký kľúč existuje.
 *
 * **Používa ho VÝHRADNE Stripe webhook** (`app/api/stripe/webhook/route.ts`).
 * Dôvod, prečo musí existovať: do `profiles` sa z appky zámerne nezapisuje
 * vôbec a `authenticated` na ňu nemá UPDATE — inak by si účet sám nastavil
 * „zaplatené". Príznak zaplatenia teda nemôže zapísať nikto prihlásený; musí
 * ho zapísať server na základe udalosti od Stripe.
 *
 * **Pravidlá, ktoré sa nesmú porušiť:**
 * - Tento súbor **nikdy neimportuj z komponentu ani zo server action.**
 *   Stráž vlastníctva je RLS a tento klient ju vypína; v akcii, ktorú vyvolá
 *   prihlásený človek, nemá čo robiť.
 * - Premenná **nesmie mať prefix `NEXT_PUBLIC_`** — tým by sa kľúč dostal do
 *   prehliadača a ktokoľvek by ovládol celú databázu.
 * - Klient si **nepamätá session** a **neobnovuje token**: nie je to
 *   používateľ, je to server.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY alebo URL chýba");
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Je `service_role` kľúč vôbec nastavený? Bez neho webhook nemá čím zapísať. */
export function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
