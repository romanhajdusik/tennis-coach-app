import type { createClient } from "@/lib/supabase/server";
import { getRosterOverview, type RosterEntry } from "@/lib/players/roster";
import type { ActivePlayer } from "@/lib/players/selected";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Podklad pre riadiaci pult šéftrénera (§5.9, mockup docs/mockups/riadiaci-pult.html).
 *
 * Šéftréner je **read-only nad celou organizáciou** — RLS mu vráti všetkých
 * hráčov aj tréningy org, ale nič nezapíše. Stavy hráčov (dni bez tréningu,
 * najbližší tréning) sa počítajú tým istým kódom ako trénerova nástenka
 * „Dnes", takže obe strany federácie vidia rovnaké čísla.
 */

export type DirectorPlayer = RosterEntry & { coachId: string };

export type DirectorCoach = {
  /** `null` = tréner, ktorý už v organizácii nie je (hráči ostali federácii). */
  userId: string | null;
  name: string;
  email: string | null;
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

type PlayerRow = ActivePlayer & { coach_id: string };

export async function getDirectorDashboard(
  supabase: SupabaseServerClient,
  organizationId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<DirectorDashboard> {
  // Aktívni hráči celej organizácie (RLS: director SELECT nad org riadkami).
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name, birth_year, coach_id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const players = (playerRows ?? []) as PlayerRow[];
  const overview = await getRosterOverview(supabase, players, timeZone, now);

  const coachIdByPlayer = new Map(
    players.map((player) => [player.id, player.coach_id]),
  );
  const entries: DirectorPlayer[] = overview.entries.map((entry) => ({
    ...entry,
    coachId: coachIdByPlayer.get(entry.player.id) ?? "",
  }));

  // Členstvo + mená. Profily členov smie šéftréner čítať cez policy
  // `profiles_select_director_org_members` (migrácia 20260806090000).
  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const coachIds = (memberRows ?? [])
    .filter((member) => member.role === "coach" && member.user_id)
    .map((member) => member.user_id as string);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", coachIds.length > 0 ? coachIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileById = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile]),
  );

  const byCoach = new Map<string, DirectorPlayer[]>();
  for (const entry of entries) {
    byCoach.set(entry.coachId, [...(byCoach.get(entry.coachId) ?? []), entry]);
  }

  const coaches: DirectorCoach[] = coachIds.map((coachId) => {
    const profile = profileById.get(coachId);
    const assigned = byCoach.get(coachId) ?? [];
    return {
      userId: coachId,
      // Meno je nepovinné (profil ho nemusí mať vyplnené) — e-mail je vždy.
      name: profile?.full_name?.trim() || profile?.email || "",
      email: profile?.email ?? null,
      players: assigned,
      attentionCount: assigned.filter((entry) => entry.attention !== "ok").length,
    };
  });

  coaches.sort((a, b) => a.name.localeCompare(b.name));

  // Hráči priradení niekomu, kto už nie je aktívnym členom — po odchode
  // trénera ostávajú federácii (to je celý zmysel org vlastníctva, §5.4),
  // takže z pultu nesmú zmiznúť, kým ich niekto neprevezme. Skupina bez
  // `userId` si názov berie z prekladov (šéftréner meno bývalého už nevidí).
  const orphaned = entries.filter((entry) => !coachIds.includes(entry.coachId));
  if (orphaned.length > 0) {
    coaches.push({
      userId: null,
      name: "",
      email: null,
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
