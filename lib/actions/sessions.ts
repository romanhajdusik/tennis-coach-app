"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { syncSessionToGoogleCalendar } from "@/lib/google/calendar";
import { getSelectedPlayer } from "@/lib/players/selected";
import { getOrgContext } from "@/lib/org/context";

export type SessionFormState = { error?: string } | undefined;

const DEFAULT_SESSION_DURATION_MINUTES = 90;

export async function createSession(
  _prevState: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const date = formData.get("date") as string;
  const durationMinutes =
    Number(formData.get("duration_minutes")) || DEFAULT_SESSION_DURATION_MINUTES;
  const t = await getTranslations("Sessions.errors");
  const tSessions = await getTranslations("Sessions");

  if (!date) {
    return { error: t("missingDate") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activePlayer = await getSelectedPlayer(supabase, user.id);

  if (!activePlayer) {
    return { error: t("noActivePlayer") };
  }

  // V org režime vlastní tréning organizácia, nie tréner (§5.4) — bez
  // organization_id by ho RLS ani nepustila zapísať.
  const org = await getOrgContext();

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      coach_id: user.id,
      organization_id: org?.id ?? null,
      player_id: activePlayer.id,
      status: "planned",
      planned_data: { date, duration_minutes: durationMinutes },
    })
    .select("id")
    .single();

  if (error || !session) {
    return { error: t("createFailed") };
  }

  const start = new Date(date);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const { googleEventId, collision } = await syncSessionToGoogleCalendar(
    supabase,
    user.id,
    tSessions("calendarEventTitle", { name: activePlayer.name }),
    start.toISOString(),
    end.toISOString(),
  );

  if (googleEventId) {
    await supabase
      .from("sessions")
      .update({ google_event_id: googleEventId })
      .eq("id", session.id);
  }

  redirect(
    collision
      ? `/sessions/${session.id}?calendarWarning=collision`
      : `/sessions/${session.id}`,
  );
}

export async function updateSessionReview(
  sessionId: string,
  _prevState: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const actualDate = formData.get("actual_date") as string;
  const notes = (formData.get("notes") as string) ?? "";
  const t = await getTranslations("Sessions.errors");

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
    return { error: t("reviewLocked") };
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

// Zrušenie plánovaného tréningu ho úplne vymaže (aj cvičenia cez cascade) —
// nie je to len zmena statusu. RLS už blokuje mazanie dokončených tréningov
// (rovnaká policy ako pri "sessions_delete_active_player"), takže tu netreba
// žiadnu ďalšiu kontrolu. Zámerne nemažeme prípadnú udalosť v Google
// Kalendári — kalendárová synchronizácia je zatiaľ len jednosmerná.
export async function deleteSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // V org režime tréner dáta nemaže — dáta vlastní federácia (§5.4/§5.7).
  // Naplánovaný tréning sa preto len ZRUŠÍ (status = 'cancelled'), aby
  // organizácii ostal úplný záznam. RLS mazanie org riadkov aj tak zamietne,
  // takže bez tejto vetvy by sa tréning ticho nezmazal a appka by tvárila,
  // že sa zrušil.
  const org = await getOrgContext();

  if (org) {
    await supabase
      .from("sessions")
      .update({ status: "cancelled" })
      .eq("id", sessionId)
      .eq("coach_id", user.id);
  } else {
    await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .eq("coach_id", user.id);
  }

  revalidatePath("/sessions");
  revalidatePath("/calendar");
  redirect("/sessions");
}
