"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireWriteAccess } from "@/lib/subscription";
import { getActivePlayers, getSelectedPlayer } from "@/lib/players/selected";
import { getOrgContext } from "@/lib/org/context";
import { getDiscipline } from "@/lib/discipline";

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
      // Štítok disciplíny patrí na TRÉNING, nie na trénera
      // (`assign_player_to_coach` mu prepisuje `coach_id` aj spätne). Mimo
      // federácie ju určuje nasadenie, vo federácii členstvo — obe vie
      // `getDiscipline()`, a RLS pri zápise žiada zhodu s členstvom.
      discipline: await getDiscipline(),
    })
    .select("id")
    .single();

  if (error || !session) {
    return { error: t("createFailed") };
  }

  redirect(`/sessions/${session.id}`);
}

type PlannedData = { date?: string; duration_minutes?: number };

// Presun naplánovaného tréningu na iný čas (prípadne inú dĺžku). Cvičenia sa
// nedotýka — v tom je celý zmysel: bez tejto akcie musel tréner tréning zrušiť
// a založiť nanovo, čím prišiel o rozpísané cvičenia (`on delete cascade`) a vo
// federačnom režime po ňom ostal riadok `cancelled`.
export async function updateSessionPlan(
  sessionId: string,
  _prevState: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const date = formData.get("date") as string;
  const durationMinutes =
    Number(formData.get("duration_minutes")) || DEFAULT_SESSION_DURATION_MINUTES;
  const t = await getTranslations("Sessions.errors");

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
    .select("id, status, planned_data")
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

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/calendar");

  redirect(`/sessions/${sessionId}`);
}

/** Kópia má aj úspešný stav — pri cudzom hráčovi sa nedá presmerovať na ňu. */
export type CopyFormState =
  | { error?: string; copiedTo?: string }
  | undefined;

/**
 * Zápis tréningu hráčovi organizácie cez `security definer` RPC.
 *
 * Cieľom môže byť aj hráč iného trénera (skupinový tréning naprieč trénermi
 * je vo federácii bežný) — takého hráča volajúci nevidí ani mu nesmie
 * zapisovať, takže všetky kontroly aj samotný zápis robí funkcia v databáze.
 */
async function copyWithinOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  targetPlayerId: string,
): Promise<CopyFormState> {
  const t = await getTranslations("Sessions.errors");

  if (!targetPlayerId) {
    return { error: t("copyInvalidPlayer") };
  }

  const { data: newSessionId, error } = await supabase.rpc(
    "copy_session_to_org_player",
    { p_session_id: sessionId, p_target_player_id: targetPlayerId },
  );

  if (error) {
    // Hlášky funkcie sú kódy, nie text pre používateľa.
    if (error.message.includes("duplicate_practice")) {
      return { error: t("copyDuplicateOrg") };
    }
    if (
      error.message.includes("target_not_found") ||
      error.message.includes("same_player") ||
      error.message.includes("target_coach_inactive")
    ) {
      return { error: t("copyInvalidPlayer") };
    }
    return { error: t("copyFailed") };
  }

  // Na kópiu sa dá presmerovať, len keď patrí hráčovi tohto trénera — cudziu
  // by mu RLS nevydala a skončil by na „nenájdené". Preto sa najprv skúsi
  // prečítať; keď nie je jeho, ostáva na mieste a dostane potvrdenie.
  const { data: readable } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", newSessionId)
    .maybeSingle();

  revalidatePath("/sessions");
  revalidatePath("/calendar");

  if (readable) {
    redirect(`/sessions/${readable.id}`);
  }

  return { copiedTo: targetPlayerId };
}

/**
 * Zapíše ten istý tréning aj ďalšiemu hráčovi trénera (skupinový tréning).
 *
 * Robí sa to **kópiou, nie spoločným tréningom s viacerými hráčmi**: celá
 * appka (dotazy, analytika, roster, rodičovské kópie aj všetky RLS policy)
 * stojí na pravidle „jeden tréning = jeden hráč" a spoločný tréning by ho
 * zrušil. Kópie sú od vzniku samostatné — druhý hráč často odohrá o cvičenie
 * menej a tréner mu to musí vedieť upraviť.
 *
 * **Kópia vzniká vždy odomknutá**, aj keď je zdroj už dokončený: zámok je
 * v DB nezvratný, takže auto-uzamknutá kópia by trénerovi nedovolila
 * odobrať cvičenie, ktoré druhý hráč neodohral. Reálny čas sa prenáša, takže
 * mu ostáva jediné ťuknutie na „Complete practice".
 */
export async function copySessionToPlayer(
  sessionId: string,
  _prevState: CopyFormState,
  formData: FormData,
): Promise<CopyFormState> {
  const targetPlayerId = formData.get("player_id") as string;
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

  // Vo federácii je skupinový tréning naprieč trénermi bežný, takže cieľom
  // môže byť aj hráč kolegu — toho tréner nevidí ani mu nesmie zapisovať
  // (RLS), celý zápis preto robí `security definer` RPC. Kópia tam vzniká pod
  // hráčovým vlastným trénerom, nie pod tým, kto ju zapísal.
  const org = await getOrgContext();

  if (org) {
    return copyWithinOrganization(supabase, sessionId, targetPlayerId);
  }

  const { data: source } = await supabase
    .from("sessions")
    .select(
      "id, player_id, organization_id, discipline, planned_data, actual_data, notes",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!source) {
    return { error: t("copyFailed") };
  }

  // Samostatný tréner kopíruje len medzi vlastnými hráčmi — inde ich ani
  // nemá. RLS by cudzí zápis aj tak zamietla, toto je preto zrozumiteľná
  // hláška namiesto tichého zlyhania.
  const players = await getActivePlayers(supabase, user.id);
  const target = players.find((player) => player.id === targetPlayerId);

  if (!target || target.id === source.player_id) {
    return { error: t("copyInvalidPlayer") };
  }

  const planned = (source.planned_data ?? {}) as PlannedData;

  // Poistka proti dvojkliku aj proti druhému skopírovaniu toho istého
  // tréningu — bez nej by hráčovi pribudli dva rovnaké tréningy a analytika
  // by mu zdvojnásobila odohraný čas.
  if (planned.date) {
    const { data: existing } = await supabase
      .from("sessions")
      .select("id")
      .eq("player_id", target.id)
      .eq("coach_id", user.id)
      .neq("status", "cancelled")
      .filter("planned_data->>date", "eq", planned.date)
      .maybeSingle();

    if (existing) {
      return { error: t("copyDuplicate", { name: target.name }) };
    }
  }

  const { data: copy, error: copyError } = await supabase
    .from("sessions")
    .insert({
      coach_id: user.id,
      organization_id: source.organization_id,
      player_id: target.id,
      // Disciplína sa berie zo ZDROJA (ako `organization_id`), nie z nasadenia —
      // kópia je ten istý tréning pre druhého hráča.
      discipline: source.discipline,
      // Nikdy nie 'completed' — do uzamknutého tréningu sa cvičenia vložiť
      // nedajú (RLS) a odomknúť sa už nedá.
      status: "planned",
      planned_data: source.planned_data,
      actual_data: source.actual_data,
      notes: source.notes,
    })
    .select("id")
    .single();

  if (copyError || !copy) {
    return { error: t("copyFailed") };
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("category, character, drill_code, duration_minutes, status, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (drills?.length) {
    // `replaces_drill_id` sa zámerne neprenáša — ukazovalo by na cvičenia
    // cudzieho tréningu.
    const { error: drillsError } = await supabase.from("session_drills").insert(
      drills.map((drill) => ({
        session_id: copy.id,
        coach_id: user.id,
        organization_id: source.organization_id,
        category: drill.category,
        character: drill.character,
        drill_code: drill.drill_code,
        duration_minutes: drill.duration_minutes,
        status: drill.status,
        sort_order: drill.sort_order,
      })),
    );

    // Tréning bez cvičení je horší než žiadny — tréner by si myslel, že má
    // kópiu hotovú. Radšej ho zmažeme a povieme, že sa to nepodarilo.
    if (drillsError) {
      await supabase.from("sessions").delete().eq("id", copy.id);
      return { error: t("copyFailed") };
    }
  }

  revalidatePath("/sessions");
  revalidatePath("/calendar");
  redirect(`/sessions/${copy.id}`);
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
// žiadnu ďalšiu kontrolu.
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
