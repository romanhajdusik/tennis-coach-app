"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireWriteAccess } from "@/lib/subscription";

// Bez zameniteľných znakov (0/O, 1/I/L), aby sa kód dal ľahko prepísať zo SMS
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function generateConnectCode(playerId: string) {
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

  // Hráč musí byť vlastný a osobný. Hranicou je RLS (migrácia
  // `20260807120000` — predtým sa dalo prepojenie vyrobiť na ĽUBOVOĽNÉ
  // `player_id` a prečítať si tak cudzieho hráča aj jeho históriu), ale
  // `playerId` sem chodí od klienta, takže ho odmietame rovno tu a nenecháme
  // to skončiť ako pätica tichých zamietnutí v cykle nižšie.
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
    .from("player_connections")
    .select("id")
    .eq("coach_id", user.id)
    .eq("player_id", playerId)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (!existing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("player_connections").insert({
        coach_id: user.id,
        player_id: playerId,
        connect_code: generateCode(),
        status: "pending",
      });
      if (!error) break;
      // Opakuje sa len zrážka vygenerovaného kódu (`connect_code` je unique).
      // Pri inej chybe je ďalší pokus zbytočný — dopadne rovnako.
      if (error.code !== "23505") break;
    }
  }

  revalidatePath("/players");
}

export async function revokeConnection(connectionId: string) {
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

  await supabase
    .from("player_connections")
    .update({ status: "revoked" })
    .eq("id", connectionId)
    .eq("coach_id", user.id);

  revalidatePath("/players");
}

export type ClaimConnectionState = { error?: string } | undefined;

export async function claimConnection(
  _prevState: ClaimConnectionState,
  formData: FormData,
): Promise<ClaimConnectionState> {
  const code = ((formData.get("code") as string) ?? "").trim().toUpperCase();
  const t = await getTranslations("Parent.errors");

  if (!code) {
    return { error: t("missingCode") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("claim_player_connection", {
    p_code: code,
  });

  if (error) {
    return { error: t("invalidCode") };
  }

  revalidatePath("/parent");
  redirect("/parent");
}
