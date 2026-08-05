import type { createClient } from "@/lib/supabase/server";
import type { ActivePlayer } from "./selected";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Prehľad celého rosteru federačného trénera (1:N) — podklad pre obrazovku
 * „Dnes" (rozvrh naprieč hráčmi) aj pre roster so stavmi na `/players`.
 *
 * Samostatný (1:1) tréner má najviac jedného hráča, takže mu to isté vráti
 * roster s jednou položkou — obrazovky si ho ale nepýtajú (§5.9).
 */

/** Odkedy sa hráč považuje za „vyžaduje pozornosť" a odkedy za neaktívneho. */
export const ATTENTION_WARNING_DAYS = 5;
export const ATTENTION_CRITICAL_DAYS = 8;

/**
 * Ako ďaleko do minulosti hľadáme posledný tréning. Bez tohto okna by sa
 * pri desiatich hráčoch a rokoch histórie ťahali tisíce riadkov (PostgREST
 * má navyše strop `max_rows`); pre otázku „ako dlho netrénoval" je hlbšia
 * história aj tak bezcenná.
 */
export const PRACTICE_LOOKBACK_DAYS = 60;

export type AttentionLevel = "ok" | "warning" | "critical";

export type ScheduledSession = {
  id: string;
  playerId: string;
  playerName: string;
  /** ISO reťazec — skutočný čas, ak už je zadaný, inak plánovaný. */
  date: string;
  status: string;
  durationMinutes: number | null;
  /** 0 = dnes, 1 = zajtra, -3 = pred tromi dňami (v pásme toho, kto pozerá). */
  dayOffset: number;
};

export type RosterEntry = {
  player: ActivePlayer;
  /** Dní od posledného tréningu; `null` = žiadny v okne `PRACTICE_LOOKBACK_DAYS`. */
  daysSincePractice: number | null;
  attention: AttentionLevel;
  nextSession: ScheduledSession | null;
};

export type RosterOverview = {
  entries: RosterEntry[];
  today: ScheduledSession[];
  tomorrow: ScheduledSession[];
  attentionCount: number;
};

type PlannedData = { date?: string; duration_minutes?: number };
type ActualData = { date?: string };

type SessionRow = {
  id: string;
  player_id: string;
  status: string;
  planned_data: unknown;
  actual_data: unknown;
};

/**
 * Deň v pásme toho, kto sa práve pozerá (`YYYY-MM-DD`). Locale `en-CA` dáva
 * presne ISO poradie, takže sa dni dajú porovnávať ako reťazce aj odčítať.
 */
function dayKeyIn(timeZone: string, date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayDiff(fromKey: string, toKey: string) {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function attentionOf(
  daysSincePractice: number | null,
  hasNextSession: boolean,
): AttentionLevel {
  // Hráč bez zaznamenaného tréningu je buď čerstvo pridelený, alebo zabudnutý —
  // rozlíši ich to, či preňho tréner niečo naplánoval.
  if (daysSincePractice === null) {
    return hasNextSession ? "ok" : "critical";
  }
  if (daysSincePractice >= ATTENTION_CRITICAL_DAYS) return "critical";
  if (daysSincePractice >= ATTENTION_WARNING_DAYS) return "warning";
  return "ok";
}

/**
 * Zoznam hráčov sa berie ako parameter (nie userId), aby si ho volajúca
 * stránka nemusela ťahať druhýkrát — `/players` ho už má.
 */
export async function getRosterOverview(
  supabase: SupabaseServerClient,
  players: ActivePlayer[],
  timeZone: string,
  now: Date = new Date(),
): Promise<RosterOverview> {
  if (players.length === 0) {
    return { entries: [], today: [], tomorrow: [], attentionCount: 0 };
  }

  const windowStart = new Date(
    now.getTime() - PRACTICE_LOOKBACK_DAYS * 86_400_000,
  ).toISOString();

  // Zrušené tréningy sa nepočítajú ani ako odtrénované, ani ako nadchádzajúce —
  // v org režime nahrádzajú mazanie (§5.4), takže ich v histórii bude pribúdať.
  const { data } = await supabase
    .from("sessions")
    .select("id, player_id, status, planned_data, actual_data")
    .in(
      "player_id",
      players.map((player) => player.id),
    )
    .neq("status", "cancelled")
    .gte("planned_data->>date", windowStart)
    .order("planned_data->>date", { ascending: true });

  const playersById = new Map(players.map((player) => [player.id, player]));
  const todayKey = dayKeyIn(timeZone, now);
  const nowMs = now.getTime();

  const sessions: ScheduledSession[] = [];
  for (const row of (data ?? []) as SessionRow[]) {
    const player = playersById.get(row.player_id);
    if (!player) continue;

    const planned = row.planned_data as PlannedData | null;
    const actual = row.actual_data as ActualData | null;
    const dateValue = actual?.date ?? planned?.date;
    if (!dateValue) continue;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;

    sessions.push({
      id: row.id,
      playerId: player.id,
      playerName: player.name,
      date: dateValue,
      status: row.status,
      durationMinutes: planned?.duration_minutes ?? null,
      dayOffset: dayDiff(todayKey, dayKeyIn(timeZone, date)),
    });
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date));

  const entries: RosterEntry[] = players.map((player) => {
    const mine = sessions.filter((session) => session.playerId === player.id);

    // „Posledný tréning" berieme podľa času, nie podľa stavu: tréner často
    // dopĺňa a uzamyká záznam až s odstupom, no odtrénované už bolo.
    const last = mine.filter((session) => Date.parse(session.date) <= nowMs).at(-1);
    const nextSession =
      mine.find(
        (session) =>
          session.status === "planned" && Date.parse(session.date) > nowMs,
      ) ?? null;

    const daysSincePractice = last ? Math.max(0, -last.dayOffset) : null;

    return {
      player,
      daysSincePractice,
      attention: attentionOf(daysSincePractice, nextSession !== null),
      nextSession,
    };
  });

  return {
    entries,
    today: sessions.filter((session) => session.dayOffset === 0),
    tomorrow: sessions.filter(
      (session) => session.dayOffset === 1 && session.status === "planned",
    ),
    attentionCount: entries.filter((entry) => entry.attention !== "ok").length,
  };
}

/**
 * Zameranie tréningu = kategórie jeho cvičení v poradí, ako ich tréner zadal
 * (napr. „Forehand · Serve"). Prázdne pole = tréning zatiaľ bez cvičení.
 */
export async function getSessionFocus(
  supabase: SupabaseServerClient,
  sessionIds: string[],
): Promise<Map<string, string[]>> {
  const focus = new Map<string, string[]>();
  if (sessionIds.length === 0) return focus;

  const { data } = await supabase
    .from("session_drills")
    .select("session_id, category, sort_order")
    .in("session_id", sessionIds)
    .order("sort_order", { ascending: true });

  for (const drill of data ?? []) {
    const categories = focus.get(drill.session_id) ?? [];
    if (!categories.includes(drill.category)) {
      categories.push(drill.category);
    }
    focus.set(drill.session_id, categories);
  }

  return focus;
}
