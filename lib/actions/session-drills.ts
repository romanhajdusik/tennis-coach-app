"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  if (!category || !character || !drillCode) {
    return { error: "Vyplň všetky polia." };
  }

  if (!VALID_CHARACTERS.includes(character)) {
    return { error: "Neplatný charakter úderu." };
  }

  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return { error: "Neplatné trvanie." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: drill, error } = await supabase
    .from("session_drills")
    .insert({
      session_id: sessionId,
      coach_id: user.id,
      category,
      character,
      drill_code: drillCode,
      duration_minutes: durationMinutes,
    })
    .select("id")
    .single();

  if (error || !drill) {
    return { error: "Cvičenie sa nepodarilo pridať." };
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

  if (!category || !character || !drillCode) {
    return { error: "Vyplň všetky polia." };
  }

  if (!VALID_CHARACTERS.includes(character)) {
    return { error: "Neplatný charakter úderu." };
  }

  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return { error: "Neplatné trvanie." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    });

  if (replacementError) {
    return { error: "Náhradné cvičenie sa nepodarilo pridať." };
  }

  await supabase
    .from("session_drills")
    .update({ status: "replaced" })
    .eq("id", replacedDrillId)
    .eq("coach_id", user.id);

  revalidatePath(`/sessions/${sessionId}`);
  return undefined;
}
