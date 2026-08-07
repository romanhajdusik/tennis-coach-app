import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { DEFAULT_CATEGORY } from "@/lib/drill-options";

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

  const { data: coach } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", player.coach_id)
    .maybeSingle();

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 sm:flex-1">
          {player.birth_year && (
            <p className="text-sm text-muted">
              {t("birthYear", { year: player.birth_year })}
            </p>
          )}
          <p className="text-sm text-muted">
            {t("coach", {
              name: coach?.full_name?.trim() || coach?.email || "—",
            })}
          </p>
        </div>

        <Link
          href={`/director/players/${player.id}/analytics/${encodeURIComponent(DEFAULT_CATEGORY)}`}
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
