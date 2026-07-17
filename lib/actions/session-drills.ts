"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type DrillFormState =
  | { error?: string; addedDrillId?: string }
  | undefined;

const VALID_CHARACTERS = ["offensive", "neutral", "defensive"];
const VALID_DURATIONS = [5, 10, 15, 20, 30];

export async function addDrill(
  sessionId: string,
  _prevState: DrillFormState,
  formData: FormData,
): Promise<DrillFormState> {
  const category = formData.get("category") as string;
  const character = formData.get("character") as string;
  const drillCode = (formData.get("drill_code") as string)?.trim();
  const durationMinutes = Number(formData.get("duration_minutes"));
  const t = await getTranslations("Sessions.errors");

  if (!category || !character || !drillCode) {
    return { error: t("missingFields") };
  }

  if (!VALID_CHARACTERS.includes(character)) {
    return { error: t("invalidCharacter") };
  }

  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return { error: t("invalidDuration") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: lastDrill } = await supabase
    .from("session_drills")
    .select("sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: drill, error } = await supabase
    .from("session_drills")
    .insert({
      session_id: sessionId,
      coach_id: user.id,
      category,
      character,
      drill_code: drillCode,
      duration_minutes: durationMinutes,
      sort_order: (lastDrill?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error || !drill) {
    return { error: t("addFailed") };
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { addedDrillId: drill.id };
}

export async function removeDrill(sessionId: string, drillId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("session_drills")
    .delete()
    .eq("id", drillId)
    .eq("coach_id", user.id);

  revalidatePath(`/sessions/${sessionId}`);
}

export async function moveDrill(
  sessionId: string,
  drillId: string,
  direction: "up" | "down",
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("id, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (!drills) return;

  const index = drills.findIndex((drill) => drill.id === drillId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapIndex < 0 || swapIndex >= drills.length) return;

  const current = drills[index];
  const swapWith = drills[swapIndex];

  await Promise.all([
    supabase
      .from("session_drills")
      .update({ sort_order: swapWith.sort_order })
      .eq("id", current.id)
      .eq("coach_id", user.id),
    supabase
      .from("session_drills")
      .update({ sort_order: current.sort_order })
      .eq("id", swapWith.id)
      .eq("coach_id", user.id),
  ]);

  revalidatePath(`/sessions/${sessionId}`);
}

export async function setDrillPlayed(
  sessionId: string,
  drillId: string,
  played: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("session_drills")
    .update({ status: played ? "played" : "not_played" })
    .eq("id", drillId)
    .eq("coach_id", user.id);

  revalidatePath(`/sessions/${sessionId}`);
}

export async function replaceDrill(
  sessionId: string,
  replacedDrillId: string,
  _prevState: DrillFormState,
  formData: FormData,
): Promise<DrillFormState> {
  const category = formData.get("category") as string;
  const character = formData.get("character") as string;
  const drillCode = (formData.get("drill_code") as string)?.trim();
  const durationMinutes = Number(formData.get("duration_minutes"));
  const t = await getTranslations("Sessions.errors");

  if (!category || !character || !drillCode) {
    return { error: t("missingFields") };
  }

  if (!VALID_CHARACTERS.includes(character)) {
    return { error: t("invalidCharacter") };
  }

  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return { error: t("invalidDuration") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: originalDrill } = await supabase
    .from("session_drills")
    .select("sort_order")
    .eq("id", replacedDrillId)
    .single();

  const originalOrder = originalDrill?.sort_order ?? 0;

  // Náhradné cvičenie sa má zaradiť hneď za to, ktoré nahrádza — posunúť
  // všetky nasledujúce o jedno miesto, aby sa uvoľnilo miesto za pôvodným.
  const { data: laterDrills } = await supabase
    .from("session_drills")
    .select("id, sort_order")
    .eq("session_id", sessionId)
    .gt("sort_order", originalOrder);

  await Promise.all(
    (laterDrills ?? []).map((drill) =>
      supabase
        .from("session_drills")
        .update({ sort_order: drill.sort_order + 1 })
        .eq("id", drill.id),
    ),
  );

  const { error: replacementError } = await supabase
    .from("session_drills")
    .insert({
      session_id: sessionId,
      coach_id: user.id,
      category,
      character,
      drill_code: drillCode,
      duration_minutes: durationMinutes,
      replaces_drill_id: replacedDrillId,
      sort_order: originalOrder + 1,
    });

  if (replacementError) {
    return { error: t("replaceFailed") };
  }

  await supabase
    .from("session_drills")
    .update({ status: "replaced" })
    .eq("id", replacedDrillId)
    .eq("coach_id", user.id);

  revalidatePath(`/sessions/${sessionId}`);
  return undefined;
}
