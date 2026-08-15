"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireWriteAccess } from "@/lib/subscription";
import { generateAccessCode } from "@/lib/access-code";
import { getDiscipline } from "@/lib/discipline";

/**
 * Prepojenie KARIET toho istého hráča naprieč disciplínami (docs §2.0, krok 4).
 * Kód vydáva vlastník dát (kondičný tréner), zadáva ho druhý tréner a odteraz
 * vidí jeho tréningy v kalendári — živo cez RLS, nie ako kópie.
 *
 * Ktorú stranu appka hrá, hovorí `cardLink` v konfigurácii disciplíny; tieto
 * akcie sú disciplínovo neutrálne a fungujú pre obe.
 *
 * Vo federácii sa nepoužijú vôbec — tam hráča obom trénerom prideľuje šéftréner
 * (`player_assignments`) a RPC to aj samo odmietne.
 */

export async function generateCardLinkCode(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Neplatiaci účet číta ďalej, ale nezapisuje (lib/subscription.ts).
  if (await requireWriteAccess(supabase, user.id)) {
    return;
  }

  // Hráč musí byť vlastný a osobný. Hranicou je RLS
  // (`player_links_insert_own_source` → `owns_personal_player`), ale `playerId`
  // sem chodí od klienta, takže sa odmieta rovno tu — rovnaký postup ako pri
  // `generateConnectCode`.
  const { data: owned } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("coach_id", user.id)
    .is("organization_id", null)
    .maybeSingle();

  if (!owned) {
    return;
  }

  const { data: existing } = await supabase
    .from("player_links")
    .select("id")
    .eq("source_player_id", playerId)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (!existing) {
    const discipline = await getDiscipline();

    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("player_links").insert({
        source_player_id: playerId,
        source_coach_id: user.id,
        source_discipline: discipline,
        link_code: generateAccessCode(),
        status: "pending",
      });
      if (!error) break;
      // Opakuje sa len zrážka vygenerovaného kódu (`link_code` je unique).
      // Pri inej chybe je ďalší pokus zbytočný — dopadne rovnako.
      if (error.code !== "23505") break;
    }
  }

  revalidatePath("/players");
}

/**
 * Zrušiť smú obaja — vydávajúci aj ten, kto kód zadal. Ide cez RPC, nie cez
 * priamy UPDATE: policy na UPDATE nevie obmedziť, ktorý stĺpec sa mení, takže
 * by si čitateľ vedel prepísať zdrojovú kartu na cudziu (viď migráciu
 * `20260815100000`).
 */
export async function revokeCardLink(linkId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (await requireWriteAccess(supabase, user.id)) {
    return;
  }

  await supabase.rpc("revoke_player_link", { p_link_id: linkId });

  revalidatePath("/players");
  revalidatePath("/calendar");
}

export type ClaimCardLinkState = { error?: string } | undefined;

/**
 * Chyby z RPC sa mapujú na hlášky. Čo nepoznáme, spadne na „neplatný kód" —
 * presnejšia hláška by trénerovi aj tak nepovedala, čo má spraviť.
 */
const CLAIM_ERROR_KEYS: Record<string, string> = {
  same_discipline: "linkSameDiscipline",
  same_player: "linkSamePlayer",
  not_your_player: "linkNotYourPlayer",
  not_supported_in_organization: "linkNotInOrganization",
};

export async function claimCardLink(
  _prevState: ClaimCardLinkState,
  formData: FormData,
): Promise<ClaimCardLinkState> {
  const code = ((formData.get("code") as string) ?? "").trim().toUpperCase();
  const playerId = (formData.get("playerId") as string) ?? "";
  const t = await getTranslations("Players.errors");

  if (!code) {
    return { error: t("linkMissingCode") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const blocked = await requireWriteAccess(supabase, user.id);
  if (blocked) {
    const tCommon = await getTranslations("Common");
    return { error: tCommon(blocked) };
  }

  const { error } = await supabase.rpc("claim_player_link", {
    p_code: code,
    p_player_id: playerId,
    p_discipline: await getDiscipline(),
  });

  if (error) {
    // Postgres vracia `raise exception` ako hlášku, nie ako kód — hľadá sa
    // teda podreťazec, rovnako ako pri ostatných RPC v projekte.
    const key = Object.keys(CLAIM_ERROR_KEYS).find((reason) =>
      error.message.includes(reason),
    );
    return { error: t(key ? CLAIM_ERROR_KEYS[key] : "linkInvalidCode") };
  }

  revalidatePath("/players");
  revalidatePath("/calendar");
  return undefined;
}
