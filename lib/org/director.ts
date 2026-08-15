import type { createClient } from "@/lib/supabase/server";
import { getRosterOverview, type RosterEntry } from "@/lib/players/roster";
import type { ActivePlayer } from "@/lib/players/selected";
import type { OrgDiscipline } from "@/lib/org/membership";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Podklad pre riadiaci pult šéftrénera (§5.9, mockup docs/mockups/riadiaci-pult.html).
 *
 * Šéftréner je **read-only nad celou organizáciou** — RLS mu vráti všetkých
 * hráčov aj tréningy org, ale nič nezapíše. Stavy hráčov (dni bez tréningu,
 * najbližší tréning) sa počítajú tým istým kódom ako trénerova nástenka
 * „Dnes", takže obe strany federácie vidia rovnaké čísla.
 *
 * Od migrácie `20260815090000` môže mať hráč naraz tenisového aj kondičného
 * trénera, takže sa zoskupuje podľa PRIRADENÍ (`player_assignments`), nie
 * podľa `players.coach_id` — ten je v org režime len autor riadku. Jeden hráč
 * sa tak v pulte objaví pod dvoma trénermi, a to je zámer: šéftréner má vidieť
 * kurt aj kondíciu vedľa seba.
 */

/** Disciplína, ktorá v organizácii znamená „tréning na kurte". */
export const COURT_DISCIPLINE: OrgDiscipline = "tennis";

export type PlayerAssignment = {
  coachId: string;
  discipline: OrgDiscipline;
};

export type DirectorPlayer = RosterEntry & {
  assignments: PlayerAssignment[];
  /** Odtrénované minúty za sledované okno, po disciplínach. */
  minutesByDiscipline: Record<OrgDiscipline, number>;
};

export type DirectorCoach = {
  /** `null` = tréner, ktorý už v organizácii nie je (hráči ostali federácii). */
  userId: string | null;
  name: string;
  email: string | null;
  /** `null` len pri skupine po odídených trénerovi (môžu byť z oboch disciplín). */
  discipline: OrgDiscipline | null;
  players: DirectorPlayer[];
  attentionCount: number;
};

export type DirectorDashboard = {
  coaches: DirectorCoach[];
  players: DirectorPlayer[];
  /** Hráči, ktorí najdlhšie netrénovali — zoradení od najhoršieho. */
  attention: DirectorPlayer[];
  coachCount: number;
  sessionsToday: number;
};

type AssignmentRow = {
  player_id: string;
  coach_id: string;
  discipline: string;
};

function emptyMinutes(): Record<OrgDiscipline, number> {
  return { tennis: 0, fitness: 0 };
}

/**
 * Tréner danej disciplíny, `null` keď hráč v nej trénera nemá. Pozornosť aj
 * meno trénera pri hráčovi sú vec KURTU — kondičný tréner za dni bez tréningu
 * na kurte nezodpovedá.
 */
export function coachIdFor(
  entry: DirectorPlayer,
  discipline: OrgDiscipline,
): string | null {
  return (
    entry.assignments.find(
      (assignment) => assignment.discipline === discipline,
    )?.coachId ?? null
  );
}

export async function getDirectorDashboard(
  supabase: SupabaseServerClient,
  organizationId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<DirectorDashboard> {
  // Aktívni hráči celej organizácie (RLS: director SELECT nad org riadkami).
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name, birth_year")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const players = (playerRows ?? []) as ActivePlayer[];

  // Stavy pozornosti sa počítajú LEN z tréningov na kurte. Kondičný tréning
  // hráča na kurt nedostane, takže by inak vyzeral ošetrený, hoci tam nebol.
  const overview = await getRosterOverview(
    supabase,
    players,
    timeZone,
    now,
    COURT_DISCIPLINE,
  );

  const { data: assignmentRows } = await supabase
    .from("player_assignments")
    .select("player_id, coach_id, discipline")
    .eq("organization_id", organizationId);

  const assignmentsByPlayer = new Map<string, PlayerAssignment[]>();
  for (const row of (assignmentRows ?? []) as AssignmentRow[]) {
    const discipline = row.discipline === "fitness" ? "fitness" : "tennis";
    assignmentsByPlayer.set(row.player_id, [
      ...(assignmentsByPlayer.get(row.player_id) ?? []),
      { coachId: row.coach_id, discipline },
    ]);
  }

  const minutesByPlayer = await getMinutesByPlayer(supabase, players, now);

  const entries: DirectorPlayer[] = overview.entries.map((entry) => ({
    ...entry,
    assignments: assignmentsByPlayer.get(entry.player.id) ?? [],
    minutesByDiscipline: minutesByPlayer.get(entry.player.id) ?? emptyMinutes(),
  }));

  // Členstvo + mená. Profily členov smie šéftréner čítať cez policy
  // `profiles_select_director_org_members` (migrácia 20260806090000).
  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("user_id, role, discipline")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const activeCoaches = (memberRows ?? [])
    .filter((member) => member.role === "coach" && member.user_id)
    .map((member) => ({
      userId: member.user_id as string,
      discipline: (member.discipline === "fitness"
        ? "fitness"
        : "tennis") as OrgDiscipline,
    }));

  const coachIds = activeCoaches.map((coach) => coach.userId);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", coachIds.length > 0 ? coachIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileById = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile]),
  );

  const coaches: DirectorCoach[] = activeCoaches.map(({ userId, discipline }) => {
    const profile = profileById.get(userId);
    const assigned = entries.filter((entry) =>
      entry.assignments.some((assignment) => assignment.coachId === userId),
    );
    return {
      userId,
      // Meno je nepovinné (profil ho nemusí mať vyplnené) — e-mail je vždy.
      name: profile?.full_name?.trim() || profile?.email || "",
      email: profile?.email ?? null,
      discipline,
      players: assigned,
      // Pozornosť je vec kurtu, takže kondičnému trénerovi sa nezobrazuje —
      // nie je to jeho zodpovednosť a nemá s tým čo robiť.
      attentionCount:
        discipline === COURT_DISCIPLINE
          ? assigned.filter((entry) => entry.attention !== "ok").length
          : 0,
    };
  });

  coaches.sort((a, b) => a.name.localeCompare(b.name));

  // Hráči s priradením na niekoho, kto už nie je aktívnym členom — po odchode
  // trénera ostávajú federácii (to je celý zmysel org vlastníctva, §5.4),
  // takže z pultu nesmú zmiznúť, kým ich niekto neprevezme. Rovnako sem patrí
  // hráč BEZ priradenia (napr. po trvalom zmazaní člena). Skupina bez `userId`
  // si názov berie z prekladov (šéftréner meno bývalého už nevidí).
  const orphaned = entries.filter(
    (entry) =>
      entry.assignments.length === 0 ||
      entry.assignments.some(
        (assignment) => !coachIds.includes(assignment.coachId),
      ),
  );
  if (orphaned.length > 0) {
    coaches.push({
      userId: null,
      name: "",
      email: null,
      discipline: null,
      players: orphaned,
      attentionCount: orphaned.filter((entry) => entry.attention !== "ok").length,
    });
  }

  return {
    coaches,
    players: entries,
    attention: entries
      .filter((entry) => entry.attention !== "ok")
      .sort(
        (a, b) =>
          (b.daysSincePractice ?? Number.MAX_SAFE_INTEGER) -
          (a.daysSincePractice ?? Number.MAX_SAFE_INTEGER),
      ),
    coachCount: coachIds.length,
    sessionsToday: overview.today.length,
  };
}

/**
 * Odtrénované minúty za posledných 30 dní, po disciplínach — z toho sa v pulte
 * skladá porovnanie „kurt vs kondícia" (§2.2: „Adam 14 hodín kurt, 0 kondička").
 *
 * Jedným dotazom pre celú organizáciu, nie po hráčoch: pri desiatich hráčoch by
 * to inak bolo desať kôl do databázy. Okno je kratšie než `PRACTICE_LOOKBACK_DAYS`
 * — otázka „ako sa delí príprava" je o aktuálnom stave, nie o histórii.
 */
const LOAD_WINDOW_DAYS = 30;

async function getMinutesByPlayer(
  supabase: SupabaseServerClient,
  players: ActivePlayer[],
  now: Date,
): Promise<Map<string, Record<OrgDiscipline, number>>> {
  const result = new Map<string, Record<OrgDiscipline, number>>();

  if (players.length === 0) {
    return result;
  }

  const windowStart = new Date(
    now.getTime() - LOAD_WINDOW_DAYS * 86_400_000,
  ).toISOString();

  const { data } = await supabase
    .from("sessions")
    .select("player_id, discipline, session_drills(duration_minutes, status)")
    .in(
      "player_id",
      players.map((player) => player.id),
    )
    .neq("status", "cancelled")
    .gte("planned_data->>date", windowStart);

  for (const row of data ?? []) {
    const discipline: OrgDiscipline =
      row.discipline === "fitness" ? "fitness" : "tennis";
    const totals = result.get(row.player_id) ?? emptyMinutes();
    for (const drill of row.session_drills ?? []) {
      // Neodohrané a nahradené cvičenia sa nepočítajú — rovnako ako v analytike.
      if (drill.status !== "played") continue;
      totals[discipline] += drill.duration_minutes ?? 0;
    }
    result.set(row.player_id, totals);
  }

  return result;
}
