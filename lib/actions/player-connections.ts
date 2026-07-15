"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

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
