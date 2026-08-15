import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type SupabaseServerClient = SupabaseClient<Database>;

/**
 * Karta toho istého hráča u trénera DRUHEJ disciplíny — alebo `null`, keď
 * prepojenie neexistuje (docs/roadmap-buduce-smery.md §2.0, krok 4).
 *
 * Platí len v samostatnom režime, kde sú to dva účty na dvoch doménach, a teda
 * dve rôzne karty. **Vo federácii nič nevracia a ani nemá** — tam je hráč jedna
 * karta s dvoma priradeniami (`player_assignments`), takže cudziu disciplínu
 * vydá tá istá `player_id` a rozlišuje sa až štítkom `sessions.discipline`.
 *
 * Hranicou prístupu je RLS (`player_links_select_own_side` + `reads_linked_*`),
 * toto je len vyhľadanie identity druhej karty.
 */
export async function getLinkedPlayerId(
  supabase: SupabaseServerClient,
  playerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("player_links")
    .select("source_player_id")
    .eq("target_player_id", playerId)
    .eq("status", "active")
    .maybeSingle();

  return data?.source_player_id ?? null;
}
