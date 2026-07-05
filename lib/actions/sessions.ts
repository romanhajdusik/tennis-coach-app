"use server";

import { redirect } from "next/navigation";
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
