import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AddDrillForm } from "./add-drill-form";
import { SessionReviewForm } from "./session-review-form";
import { DrillRow, type Drill } from "./drill-row";
import { getDrillOptionsByCategory } from "@/lib/actions/drill-codes";

type PlannedData = { date?: string };
type ActualData = { date?: string };

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ calendarWarning?: string }>;
}) {
  const { id } = await params;
  const { calendarWarning } = await searchParams;
  const t = await getTranslations("Sessions.detail");
  const tSessions = await getTranslations("Sessions");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, planned_data, actual_data, notes")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    notFound();
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select(
      "id, category, character, drill_code, duration_minutes, status, replaces_drill_id",
    )
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const planned = session.planned_data as PlannedData | null;
  const actual = session.actual_data as ActualData | null;
  const totalMinutes = (drills ?? [])
    .filter((drill) => drill.status === "played")
    .reduce((sum, drill) => sum + drill.duration_minutes, 0);

  // náhradné cvičenie sa zobrazí hneď za tým, ktoré nahrádza
  const replacementByOriginal = new Map(
    (drills ?? [])
      .filter((drill) => drill.replaces_drill_id)
      .map((drill) => [drill.replaces_drill_id as string, drill]),
  );
  const orderedDrills: Drill[] = [];
  for (const drill of drills ?? []) {
    if (drill.replaces_drill_id) continue;
    orderedDrills.push(drill);
    let current = drill;
    while (replacementByOriginal.has(current.id)) {
      current = replacementByOriginal.get(current.id)!;
      orderedDrills.push(current);
    }
  }
  const canEdit = session.status !== "completed";
  const drillsByCategory = await getDrillOptionsByCategory(supabase, user.id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("heading")}
        </h1>
        <Link
          href="/sessions"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          {tCommon("back")}
        </Link>
      </div>

      {calendarWarning === "collision" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          {t("calendarWarning")}
        </p>
      )}

      <SessionReviewForm
        sessionId={session.id}
        status={session.status}
        initialDate={actual?.date ?? planned?.date}
        initialNotes={session.notes}
      />

      {canEdit && (
        <AddDrillForm
          sessionId={session.id}
          drillsByCategory={drillsByCategory}
        />
      )}

      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          {planned?.date
            ? format.dateTime(new Date(planned.date), {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : tSessions("noDate")}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("totalDuration", { minutes: totalMinutes })}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {t("drillsHeading")}
        </h2>
        {orderedDrills.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("noDrills")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orderedDrills.map((drill) => (
              <DrillRow
                key={drill.id}
                sessionId={session.id}
                drill={drill}
                canEdit={canEdit}
                drillsByCategory={drillsByCategory}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
