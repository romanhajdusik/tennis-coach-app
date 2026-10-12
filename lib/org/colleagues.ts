import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Mená členov vlastnej organizácie (aj odídených — podpísali staré tréningy),
 * podľa `user_id`.
 *
 * Od migrácie `20261012090000` môže mať hráč vo federácii viac trénerov tej
 * istej disciplíny a každý vidí aj tréningy kolegov — pri nich má stáť, kto ich
 * viedol. `profiles` trénerovi vydá len vlastný riadok, preto mená dáva úzka
 * funkcia `org_member_names` (len meno, len vlastná organizácia).
 *
 * Mimo organizácie funkcia nevráti nič, takže samostatnému trénerovi je to
 * prázdna mapa. Volaj ju len tam, kde naozaj je cudzí tréning tej istej
 * disciplíny — samostatný tréner ho mať nemôže a ušetrí sa dotaz.
 */
export async function getColleagueNames(
  supabase: SupabaseServerClient,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc("org_member_names");
  return new Map(
    (data ?? []).map((row) => [row.user_id, row.full_name.trim()]),
  );
}
