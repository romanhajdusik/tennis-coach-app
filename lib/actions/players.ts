"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type PlayerFormState = { error?: string } | undefined;

export async function createPlayer(
  _prevState: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const name = formData.get("name") as string;
  const birthDate = formData.get("birth_date") as string;
  const t = await getTranslations("Players.errors");

  if (!name) {
    return { error: t("missingName") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingActive } = await supabase
    .from("players")
    .select("id")
    .eq("coach_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const { error } = await supabase.from("players").insert({
    coach_id: user.id,
    name,
    birth_date: birthDate || null,
    is_active: !existingActive,
  });

  if (error) {
    return { error: t("createFailed") };
  }

  revalidatePath("/players");
}

export async function deactivatePlayer(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("players")
    .update({ is_active: false })
    .eq("id", playerId)
    .eq("coach_id", user.id);

  revalidatePath("/players");
}

export async function activatePlayer(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Najprv deaktivovať doterajšieho aktívneho hráča — inak by zápis narazil
  // na unikátny index one_active_player (vždy len jeden aktívny na trénera)
  await supabase
    .from("players")
    .update({ is_active: false })
    .eq("coach_id", user.id)
    .eq("is_active", true);

  await supabase
    .from("players")
    .update({ is_active: true })
    .eq("id", playerId)
    .eq("coach_id", user.id);

  revalidatePath("/players");
}
