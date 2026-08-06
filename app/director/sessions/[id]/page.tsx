import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { CHARACTER_LABELS } from "@/lib/drill-options";

type PlannedData = { date?: string };
type ActualData = { date?: string };

// Tie isté farby ako u trénera (app/sessions/[id]/drill-row.tsx) aj u rodiča —
// šéftréner má vidieť rozpis rovnako odlíšený ako ten, kto ho zapísal.
const STATUS_STYLES: Record<string, string> = {
  played: "border-emerald-900 bg-emerald-950",
  not_played: "border-red-900 bg-red-950",
  replaced: "border-yellow-900 bg-yellow-950",
};

const SESSION_STATUS_TEXT_CLASSES: Record<string, string> = {
  planned: "text-emerald-400",
  completed: "text-red-400",
  cancelled: "text-muted",
};

/** Read-only detail tréningu pre šéftrénera — živý pohľad cez RLS, bez editácie. */
export default async function DirectorSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Director.session");
  const tSessions = await getTranslations("Sessions");
  const tDrillRow = await getTranslations("Sessions.drillRow");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const { supabase, org } = await requireDirector();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, player_id, status, planned_data, actual_data, notes, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.organization_id !== org.id) {
    notFound();
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("id, category, character, drill_code, duration_minutes, status")
    .eq("session_id", session.id)
    .order("sort_order", { ascending: true });

  const planned = session.planned_data as PlannedData | null;
  const actual = session.actual_data as ActualData | null;
  const date = actual?.date ?? planned?.date;
  const totalMinutes = (drills ?? [])
    .filter((drill) => drill.status === "played")
    .reduce((sum, drill) => sum + drill.duration_minutes, 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t("heading")}</h1>
        <Link
          href={`/director/players/${session.player_id}`}
          className="text-sm font-medium text-muted underline"
        >
          {t("back")}
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-foreground">
            {date
              ? format.dateTime(new Date(date), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : tSessions("noDate")}
          </p>
          <span
            className={`flex-none text-xs font-medium ${
              SESSION_STATUS_TEXT_CLASSES[session.status] ?? "text-muted"
            }`}
          >
            {tCommon(`status.${session.status}`)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {t("totalDuration", { minutes: totalMinutes })}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted">{t("notes")}</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
          {session.notes || t("noNotes")}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">{t("drillsHeading")}</h2>
        {!drills || drills.length === 0 ? (
          <p className="text-sm text-muted">{t("noDrills")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drills.map((drill) => (
              <li
                key={drill.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                  STATUS_STYLES[drill.status] ?? STATUS_STYLES.played
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {drill.category} · {drill.drill_code}
                  </p>
                  <p className="text-sm text-muted">
                    {CHARACTER_LABELS[drill.character] ?? drill.character}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {drill.status !== "played" && (
                    <span className="text-xs font-medium text-muted">
                      {drill.status === "not_played"
                        ? tDrillRow("statusNotPlayed")
                        : tDrillRow("statusReplaced")}
                    </span>
                  )}
                  <span className="text-sm font-medium text-muted">
                    {drill.duration_minutes} min
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
