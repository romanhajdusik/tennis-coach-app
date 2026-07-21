import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CHARACTER_LABELS } from "@/lib/drill-options";

type PlannedData = { date?: string };
type ActualData = { date?: string };

// Rovnaké farby ako v app/sessions/[id]/drill-row.tsx (STATUS_STYLES) —
// rodič má vidieť rozpis rovnako farebne odlíšený ako tréner.
const STATUS_STYLES: Record<string, string> = {
  played:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950",
  not_played: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
  replaced:
    "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
};

// Rovnaký princíp ako v app/calendar/page.tsx — naplánovaný zelenou,
// dokončený červenou.
const SESSION_STATUS_TEXT_CLASSES: Record<string, string> = {
  planned: "text-emerald-700 dark:text-emerald-400",
  completed: "text-red-700 dark:text-red-400",
};

export default async function ParentSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Sessions.detail");
  const tSessions = await getTranslations("Sessions");
  const tReview = await getTranslations("Sessions.review");
  const tDrillRow = await getTranslations("Sessions.drillRow");
  const tCommon = await getTranslations("Common");
  const tParent = await getTranslations("Parent.calendar");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  const { data: record } = await supabase
    .from("parent_session_records")
    .select("id, status, planned_data, actual_data, notes")
    .eq("id", id)
    .eq("parent_id", user.id)
    .maybeSingle();

  if (!record) {
    notFound();
  }

  const { data: drills } = await supabase
    .from("parent_session_drill_records")
    .select("id, category, character, drill_code, duration_minutes, status")
    .eq("parent_record_id", record.id);

  const planned = record.planned_data as PlannedData | null;
  const actual = record.actual_data as ActualData | null;
  const date = actual?.date ?? planned?.date;
  const totalMinutes = (drills ?? [])
    .filter((drill) => drill.status === "played")
    .reduce((sum, drill) => sum + drill.duration_minutes, 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("heading")}
        </h1>
        <Link
          href="/parent"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          {tParent("back")}
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {date
              ? format.dateTime(new Date(date), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : tSessions("noDate")}
          </p>
          <span
            className={`text-xs font-medium ${
              SESSION_STATUS_TEXT_CLASSES[record.status] ??
              "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {tCommon(`status.${record.status}`)}
          </span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("totalDuration", { minutes: totalMinutes })}
        </p>
      </div>

      {record.notes && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {tReview("notesLabel")}
          </h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-50">
            {record.notes}
          </p>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {t("drillsHeading")}
        </h2>
        {!drills || drills.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("noDrills")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drills.map((drill) => (
              <li
                key={drill.id}
                className={`flex items-center justify-between rounded-xl border p-4 ${STATUS_STYLES[drill.status] ?? STATUS_STYLES.played}`}
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {drill.category} · {drill.drill_code}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {CHARACTER_LABELS[drill.character] ?? drill.character}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {drill.status !== "played" && (
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {drill.status === "not_played"
                        ? tDrillRow("statusNotPlayed")
                        : tDrillRow("statusReplaced")}
                    </span>
                  )}
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
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
