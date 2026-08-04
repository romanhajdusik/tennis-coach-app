import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Ktorého hráča má tréner práve „otvoreného". Voľba je vec zariadenia
 * (rovnako ako jazyk či časové pásmo), nie stav v databáze — dvaja tréneri
 * ani dve zariadenia sa tak neprebíjajú.
 */
export const SELECTED_PLAYER_COOKIE = "plaw_selected_player";

export type ActivePlayer = {
  id: string;
  name: string;
  birth_year: number | null;
};

/**
 * Aktívni hráči trénera.
 *
 * Samostatný (1:1) režim: najviac jeden — drží to unikátny index
 * `one_active_player`. Federačný (org) režim: tréner je zamestnanec
 * s viacerými pridelenými hráčmi naraz (1:N), index je tam uvoľnený.
 */
export async function getActivePlayers(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ActivePlayer[]> {
  const { data } = await supabase
    .from("players")
    .select("id, name, birth_year")
    .eq("coach_id", userId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return data ?? [];
}

/**
 * Hráč, na ktorého sa tréner práve pozerá — **jediný zdroj pravdy** pre
 * kalendár, plánovanie, záznam aj analytiku.
 *
 * Voľba sa pamätá v cookie, ale vždy sa overuje voči zoznamu z databázy (ten
 * je orezaný RLS): podvrhnutá cookie teda nevie vybrať cudzieho hráča, nanajvýš
 * sa ignoruje a použije sa prvý v poradí. Rovnako sa samo zotaví, keď sa
 * vybraný hráč medzitým archivuje.
 */
export async function getSelectedPlayer(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ActivePlayer | null> {
  const players = await getActivePlayers(supabase, userId);
  return pickSelectedPlayer(players, await readSelectedPlayerId());
}

export async function readSelectedPlayerId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SELECTED_PLAYER_COOKIE)?.value ?? null;
}

export function pickSelectedPlayer(
  players: ActivePlayer[],
  selectedId: string | null,
): ActivePlayer | null {
  if (players.length === 0) {
    return null;
  }
  if (!selectedId) {
    return players[0];
  }
  return players.find((player) => player.id === selectedId) ?? players[0];
}
