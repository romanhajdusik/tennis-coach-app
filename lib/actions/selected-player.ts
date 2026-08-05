"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SELECTED_PLAYER_COOKIE } from "@/lib/players/selected";

/**
 * Prepnutie na iného hráča (federačný tréner má viacerých naraz).
 * Voľbu si pamätá cookie, viď lib/players/selected.ts.
 */
async function applySelectedPlayer(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Overenie, že hráč je naozaj môj a aktívny. RLS by cudzieho ani nevrátila —
  // toto je druhá poistka, aby sa do cookie nedostalo cudzie id.
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("coach_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!player) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(SELECTED_PLAYER_COOKIE, playerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Vybraný hráč ovplyvňuje takmer každú obrazovku, preto celý layout.
  revalidatePath("/", "layout");
}

export async function selectPlayer(playerId: string) {
  await applySelectedPlayer(playerId);
}

/**
 * Prepnutie hráča a rovno prechod na jeho obrazovku — z rozvrhu „Dnes" a
 * z rosteru je ťuknutie na tréning zároveň prepnutím kontextu, inak by
 * appka ďalej zobrazovala dáta predtým vybraného hráča.
 */
export async function selectPlayerAndOpen(playerId: string, path: string) {
  await applySelectedPlayer(playerId);

  // Cieľ zadáva appka (bindovaný argument), nie používateľ — kontrola je len
  // poistka, aby sa z formulára nedal spraviť otvorený presmerovávač.
  redirect(path.startsWith("/") && !path.startsWith("//") ? path : "/");
}
