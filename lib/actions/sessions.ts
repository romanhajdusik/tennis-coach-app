"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireWriteAccess } from "@/lib/subscription";
import {
  rescheduleSessionInGoogleCalendar,
  syncSessionToGoogleCalendar,
} from "@/lib/google/calendar";
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

  const blocked = await requireWriteAccess(supabase, user.id);
  if (blocked) {
    return { error: (await getTranslations("Common"))(blocked) };
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

type PlannedData = { date?: string; duration_minutes?: number };

// Presun naplánovaného tréningu na iný čas (prípadne inú dĺžku). Cvičenia sa
// nedotýka — v tom je celý zmysel: bez tejto akcie musel tréner tréning zrušiť
// a založiť nanovo, čím prišiel o rozpísané cvičenia (`on delete cascade`),
// vo federačnom režime po ňom ostal riadok `cancelled` a v Google Kalendári
// osirotená udalosť.
export async function updateSessionPlan(
  sessionId: string,
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

  const blocked = await requireWriteAccess(supabase, user.id);
  if (blocked) {
    return { error: (await getTranslations("Common"))(blocked) };
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, planned_data, google_event_id, players(name)")
    .eq("id", sessionId)
    .maybeSingle();

  // Presunúť sa dá LEN naplánovaný tréning. RLS blokuje úpravu dokončeného,
  // ale zrušený (`cancelled`) by prešiel — a vrátiť zrušený tréning späť do
  // hry je samostatné rozhodnutie, nie vedľajší účinok presunu.
  if (!session || session.status !== "planned") {
    return { error: t("rescheduleLocked") };
  }

  // Zvyšok `planned_data` sa zachová — appka tam dnes drží len dátum a dĺžku,
  // ale prepísať celý objekt by ticho zahodilo čokoľvek, čo tam pribudne.
  const planned = (session.planned_data ?? {}) as PlannedData;

  const { error, count } = await supabase
    .from("sessions")
    .update(
      {
        planned_data: { ...planned, date, duration_minutes: durationMinutes },
      },
      { count: "exact" },
    )
    .eq("id", sessionId)
    .eq("coach_id", user.id);

  if (error || count === 0) {
    return { error: t("rescheduleFailed") };
  }

  // Kalendár až po zápise do DB (rovnaké poradie ako pri zakladaní): appka je
  // zdroj pravdy a zlyhanie Googlu nesmie presun zhodiť.
  const playerName =
    (session.players as { name: string } | null)?.name ?? "";
  const start = new Date(date);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const { googleEventId, collision } = await rescheduleSessionInGoogleCalendar(
    supabase,
    user.id,
    session.google_event_id,
    tSessions("calendarEventTitle", { name: playerName }),
    start.toISOString(),
    end.toISOString(),
  );

  // Väzba sa prepisuje len keď sa naozaj zmenila (pôvodná udalosť zmizla
  // z kalendára, alebo pribudla až teraz). `null` znamená „kalendár nie je
  // pripojený alebo zlyhal" — vtedy sa doterajšia väzba nesmie zahodiť.
  if (googleEventId && googleEventId !== session.google_event_id) {
    await supabase
      .from("sessions")
      .update({ google_event_id: googleEventId })
      .eq("id", sessionId);
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/calendar");

  redirect(
    collision
      ? `/sessions/${sessionId}?calendarWarning=collision`
      : `/sessions/${sessionId}`,
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

  const blocked = await requireWriteAccess(supabase, user.id);
  if (blocked) {
    return { error: (await getTranslations("Common"))(blocked) };
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

  // Neplatiaci účet číta ďalej, ale nezapisuje (lib/subscription.ts).
  if (await requireWriteAccess(supabase, user.id)) {
    return;
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

  // Neplatiaci účet číta ďalej, ale nezapisuje (lib/subscription.ts).
  if (await requireWriteAccess(supabase, user.id)) {
    return;
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
