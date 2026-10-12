"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";

export type CoachAssignmentState =
  | { error?: string; message?: string }
  | undefined;

/**
 * Priradenie trénerov hráčom — jednotlivo aj hromadne (hráči × tréneri).
 *
 * Od migrácie `20261012090000` môže mať hráč v disciplíne viac trénerov naraz
 * (tour teamy: dvaja tenisoví a dvaja kondiční, ktorí sa striedajú po
 * mesiacoch; zväzy: skupina 2–3 trénerov na 6–10 hráčov). Staré „preradenie"
 * zaniklo: výmena trénera = pridať nového a odobrať starého.
 *
 * Celú kontrolu robia RPC `add_player_coaches` / `remove_player_coaches`
 * (volajúci je šéftréner tejto org, hráči do nej patria, cieľ je jej aktívny
 * tréner) — tu chyby len prekladáme.
 *
 * **História sa už neprepisuje:** dokončený tréning ostáva podpísaný tým, kto
 * ho viedol. Odobratie trénera zruší len jeho NAPLÁNOVANÉ tréningy s tými
 * hráčmi (rozhodol user 2026-10-12: nasledujúci tréner si plán zostaví sám).
 */
export async function addPlayerCoaches(
  _prevState: CoachAssignmentState,
  formData: FormData,
): Promise<CoachAssignmentState> {
  return changeAssignments("add", formData);
}

export async function removePlayerCoaches(
  _prevState: CoachAssignmentState,
  formData: FormData,
): Promise<CoachAssignmentState> {
  return changeAssignments("remove", formData);
}

async function changeAssignments(
  mode: "add" | "remove",
  formData: FormData,
): Promise<CoachAssignmentState> {
  const t = await getTranslations("Director.assign");
  const playerIds = idsOf(formData, "playerId");
  const coachIds = idsOf(formData, "coachId");

  if (playerIds.length === 0 || coachIds.length === 0) {
    return { error: t("errors.nothingSelected") };
  }
  // Odobratie ruší naplánované tréningy — bez výslovného potvrdenia sa nerobí.
  if (mode === "remove" && formData.get("confirm") !== "yes") {
    return { error: t("errors.confirmRemove") };
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

  const { data: count, error } = await supabase.rpc(
    mode === "add" ? "add_player_coaches" : "remove_player_coaches",
    { p_player_ids: playerIds, p_coach_ids: coachIds },
  );

  if (error) {
    const reason = error.message ?? "";
    if (reason.includes("target_not_coach")) {
      return { error: t("errors.targetNotCoach") };
    }
    if (reason.includes("player_not_in_org")) {
      return { error: t("errors.playerNotInOrg") };
    }
    if (reason.includes("nothing_selected")) {
      return { error: t("errors.nothingSelected") };
    }
    return { error: t("errors.failed") };
  }

  // Priradenie mení zoskupenie v pulte aj to, komu sa hráč zobrazí v appke.
  revalidatePath("/director", "layout");
  return {
    message:
      mode === "add"
        ? t("added", { count: count ?? 0 })
        : t("removed", { count: count ?? 0 }),
  };
}

function idsOf(formData: FormData, name: string): string[] {
  return [
    ...new Set(
      formData
        .getAll(name)
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}
