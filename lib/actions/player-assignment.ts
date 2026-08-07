"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";

export type AssignFormState = { error?: string } | undefined;

/**
 * Preradenie hráča inému trénerovi organizácie.
 *
 * Celú kontrolu robí RPC `assign_player_to_coach` (volajúci je šéftréner tejto
 * org, hráč do nej patrí, cieľ je jej aktívny tréner) — tu chyby len
 * prekladáme. Bez tejto akcie ostali hráči odídeného trénera federácii, ale
 * nemal ich kto prevziať (§5.4).
 *
 * Presúva sa aj história (tréningy, cvičenia, testy) — v org režime je
 * `coach_id` priradenie, nie autorstvo. Pozri komentár v migrácii
 * `20260807100000_assign_player_to_coach.sql`.
 */
export async function assignPlayer(
  playerId: string,
  _prevState: AssignFormState,
  formData: FormData,
): Promise<AssignFormState> {
  const coachId = ((formData.get("coachId") as string) ?? "").trim();
  const t = await getTranslations("Director.assign.errors");

  if (!coachId) {
    return { error: t("missingCoach") };
  }

  const org = await getOrgContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  // Smerovanie, nie bezpečnostná hranica — tou je kontrola vnútri RPC.
  if (!org || (await getOrgRole(supabase, user.id)) !== "director") {
    redirect("/");
  }

  const { error } = await supabase.rpc("assign_player_to_coach", {
    p_player_id: playerId,
    p_coach_id: coachId,
  });

  if (error) {
    const reason = error.message ?? "";
    if (reason.includes("target_not_coach")) {
      return { error: t("targetNotCoach") };
    }
    if (reason.includes("player_not_in_org")) {
      return { error: t("playerNotInOrg") };
    }
    return { error: t("failed") };
  }

  // Priradenie mení zoskupenie v pulte aj to, komu sa hráč zobrazí v appke.
  revalidatePath("/director");
  revalidatePath(`/director/players/${playerId}`);
  revalidatePath("/director/team");
  return undefined;
}
