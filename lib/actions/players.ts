"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/context";

export type PlayerFormState = { error?: string } | undefined;

export async function createPlayer(
  _prevState: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const name = (formData.get("name") as string)?.trim();
  const birthYearRaw = (formData.get("birth_year") as string)?.trim();
  const t = await getTranslations("Players.errors");

  if (!name) {
    return { error: t("missingName") };
  }

  let birthYear: number | null = null;
  if (birthYearRaw) {
    const parsed = Number.parseInt(birthYearRaw, 10);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > currentYear) {
      return { error: t("invalidBirthYear") };
    }
    birthYear = parsed;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Federačný tréner je zamestnanec s viacerými hráčmi naraz (1:N), takže nový
  // hráč je vždy aktívny a vlastní ho organizácia (§5.4). Samostatný tréner má
  // model 1:1 — nový hráč sa aktivuje, len ak zatiaľ žiadneho aktívneho nemá.
  const org = await getOrgContext();

  let isActive = true;
  if (!org) {
    const { data: existingActive } = await supabase
      .from("players")
      .select("id")
      .eq("coach_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    isActive = !existingActive;
  }

  const { error } = await supabase.from("players").insert({
    coach_id: user.id,
    organization_id: org?.id ?? null,
    name,
    birth_year: birthYear,
    is_active: isActive,
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

  // V samostatnom režime treba najprv deaktivovať doterajšieho aktívneho
  // hráča — inak by zápis narazil na unikátny index one_active_player (vždy
  // len jeden aktívny na trénera). V org režime je index uvoľnený (1:N),
  // takže vrátenie hráča z archívu nesmie ostatných zhodiť.
  const org = await getOrgContext();

  if (!org) {
    await supabase
      .from("players")
      .update({ is_active: false })
      .eq("coach_id", user.id)
      .eq("is_active", true);
  }

  await supabase
    .from("players")
    .update({ is_active: true })
    .eq("id", playerId)
    .eq("coach_id", user.id);

  revalidatePath("/players");
}
