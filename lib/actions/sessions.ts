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
  const focus = formData.get("focus") as string;
  const durationMinutes = formData.get("duration_minutes") as string;

  if (!date || !focus || !durationMinutes) {
    return { error: "Vyplň všetky polia." };
  }

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Trvanie musí byť kladné číslo (v minútach)." };
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

  const { error } = await supabase.from("sessions").insert({
    coach_id: user.id,
    player_id: activePlayer.id,
    status: "planned",
    planned_data: { date, focus, duration_minutes: duration },
  });

  if (error) {
    return { error: "Tréning sa nepodarilo naplánovať." };
  }

  revalidatePath("/sessions");
}
