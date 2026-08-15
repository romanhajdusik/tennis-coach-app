import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { AssignPlayer } from "@/app/director/assign-player";
import { getDisciplineConfig } from "@/lib/discipline";

type PlannedData = { date?: string };
type ActualData = { date?: string };

const STATUS_TEXT_CLASSES: Record<string, string> = {
  planned: "text-emerald-400",
  completed: "text-red-400",
  cancelled: "text-muted",
};

/**
 * Drill-in šéftrénera do konkrétneho hráča — **živý** read-only pohľad cez
 * RLS (nie kópie ako u rodiča: dáta vlastní organizácia, takže pri odchode
 * trénera nič nezmizne a kopírovať ich netreba, §5.4).
 */
export default async function DirectorPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Director.player");
  const tDirector = await getTranslations("Director");
  const tAssign = await getTranslations("Director.assign");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const { supabase, org } = await requireDirector();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, birth_year, coach_id, organization_id")
    .eq("id", id)
    .maybeSingle();

  // Cudzieho hráča RLS nevydá; kontrola organizácie je druhá poistka, aby sa
  // pult nedal použiť naprieč tenantmi ani pri chybe policy.
  if (!player || player.organization_id !== org.id) {
    notFound();
  }

  // Aktívni tréneri organizácie — zoznam, komu sa dá hráč prideliť, a zároveň
  // zdroj mena súčasného trénera. Profil odídeného člena šéftréner už nevidí
  // (policy `profiles_select_director_org_members`), preto sa meno hľadá tu
  // a nie samostatným dotazom na `profiles`.
  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, discipline")
    .eq("organization_id", org.id)
    .eq("role", "coach")
    .eq("status", "active");

  const activeCoaches = (members ?? []).filter(
    (member): member is { user_id: string; discipline: string } =>
      Boolean(member.user_id),
  );
  const coachIds = activeCoaches.map((member) => member.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", coachIds.length > 0 ? coachIds : [org.id]);

  const assignable = activeCoaches.map(({ user_id, discipline }) => {
    const profile = (profiles ?? []).find((row) => row.id === user_id);
    return {
      userId: user_id,
      name: profile?.full_name?.trim() || profile?.email || "—",
      discipline,
    };
  });
  assignable.sort((a, b) => a.name.localeCompare(b.name));

  // Súčasný tréner sa hľadá cez PRIRADENIE na kurt, nie cez `players.coach_id`
  // — ten je v org režime autor riadku. Hráč môže mať aj kondičného trénera,
  // toho preradenie na kurte nemení.
  const { data: playerAssignments } = await supabase
    .from("player_assignments")
    .select("coach_id, discipline")
    .eq("player_id", player.id);

  const courtCoachId =
    (playerAssignments ?? []).find((row) => row.discipline === "tennis")
      ?.coach_id ?? null;

  const currentCoach =
    assignable.find((coach) => coach.userId === courtCoachId) ?? null;

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, status, planned_data, actual_data")
    .eq("player_id", player.id);

  const { data: drills } = await supabase
    .from("session_drills")
    .select("session_id, duration_minutes, status")
    .in("session_id", (sessions ?? []).map((session) => session.id));

  const drillTotals = new Map<string, { count: number; minutes: number }>();
  for (const drill of drills ?? []) {
    if (drill.status !== "played") continue;
    const total = drillTotals.get(drill.session_id) ?? { count: 0, minutes: 0 };
    total.count += 1;
    total.minutes += drill.duration_minutes;
    drillTotals.set(drill.session_id, total);
  }

  const ordered = (sessions ?? [])
    .map((session) => {
      const planned = session.planned_data as PlannedData | null;
      const actual = session.actual_data as ActualData | null;
      return { ...session, date: actual?.date ?? planned?.date ?? null };
    })
    .filter((session) => session.date)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string));

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-semibold text-foreground">
          {player.name}
        </h1>
        <Link
          href="/director"
          className="flex-none text-sm font-medium text-muted underline"
        >
          {t("back")}
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-1">
          {player.birth_year && (
            <p className="text-sm text-muted">
              {t("birthYear", { year: player.birth_year })}
            </p>
          )}
          {/* Kým hráč trénera má, meno ukazuje výber nižšie — písať ho dvakrát
              netreba. Po odchode trénera výber nikoho vybraného nemá, a to
              treba povedať nahlas. */}
          {!currentCoach && (
            <p className="text-sm text-muted">
              {t("coach", { name: tDirector("formerCoach") })}
            </p>
          )}

          {/* Jediný zápis šéftrénera do hráčskeho riadku — a to len do
              priradenia (§5.4). Zvyšok pultu ostáva read-only. */}
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">
                {tAssign("heading")}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {tAssign("description")}
              </p>
            </div>
            <AssignPlayer
              playerId={player.id}
              coaches={assignable}
              currentCoachId={currentCoach?.userId ?? null}
            />
          </div>
        </div>

        <Link
          href={`/director/players/${player.id}/analytics/${encodeURIComponent((await getDisciplineConfig()).defaultCategory)}`}
          className="flex-none rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
        >
          {t("openAnalytics")}
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {t("sessionsHeading")}
        </h2>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted">{t("noSessions")}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ordered.map((session) => {
              const total = drillTotals.get(session.id);
              return (
                <li key={session.id}>
                  <Link
                    href={`/director/sessions/${session.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {format.dateTime(new Date(session.date as string), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      {total && (
                        <span className="block text-xs text-muted">
                          {t("sessionDrills", {
                            count: total.count,
                            minutes: total.minutes,
                          })}
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex-none text-xs font-medium ${
                        STATUS_TEXT_CLASSES[session.status] ?? "text-muted"
                      }`}
                    >
                      {tCommon(`status.${session.status}`)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
