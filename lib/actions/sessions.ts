"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SessionFormState = { error?: string } | undefined;

export async function createSession(
  _prevState: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const date = formData.get("date") as string;

  if (!date) {
    return { error: "Vyber dátum a čas tréningu." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: activePlayer } = await supabase
    .from("players")
    .select("id")
    .eq("coach_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!activePlayer) {
    return { error: "Najprv nastav aktívneho hráča." };
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      coach_id: user.id,
      player_id: activePlayer.id,
      status: "planned",
      planned_data: { date },
    })
    .select("id")
    .single();

  if (error || !session) {
    return { error: "Tréning sa nepodarilo naplánovať." };
  }

  redirect(`/sessions/${session.id}`);
}

export async function updateSessionReview(
  sessionId: string,
  _prevState: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const actualDate = formData.get("actual_date") as string;
  const notes = (formData.get("notes") as string) ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error, count } = await supabase
    .from("sessions")
    .update(
      {
        actual_data: actualDate ? { date: actualDate } : null,
        notes: notes || null,
      },
      { count: "exact" },
    )
    .eq("id", sessionId)
    .eq("coach_id", user.id);

  if (error || count === 0) {
    return { error: "Tréning je uzamknutý, poznámky sa nepodarilo uložiť." };
  }

  revalidatePath(`/sessions/${sessionId}`);
  return undefined;
}

export async function completeSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId)
    .eq("coach_id", user.id);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
}
