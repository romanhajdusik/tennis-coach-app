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
      "id, category, character, drill_code, duration_minutes, status, sort_order",
    )
    .eq("session_id", id)
    .order("sort_order", { ascending: true });

  const planned = session.planned_data as PlannedData | null;
  const actual = session.actual_data as ActualData | null;
  const totalMinutes = (drills ?? [])
    .filter((drill) => drill.status === "played")
    .reduce((sum, drill) => sum + drill.duration_minutes, 0);

  const orderedDrills: Drill[] = drills ?? [];
  const canEdit = session.status !== "completed";
  const drillsByCategory = await getDrillOptionsByCategory(supabase, user.id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("heading")}
        </h1>
        <Link
          href="/sessions"
          className="text-sm font-medium text-muted underline "
        >
          {tCommon("back")}
        </Link>
      </div>

      {calendarWarning === "collision" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-amber-950 text-amber-400">
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
          initialCategory={orderedDrills.at(-1)?.category}
        />
      )}

      <div className="rounded-xl border border-border bg-surface p-4 ">
        <p className="font-medium text-foreground ">
          {planned?.date
            ? format.dateTime(new Date(planned.date), {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : tSessions("noDate")}
        </p>
        <p className="text-sm text-muted ">
          {t("totalDuration", { minutes: totalMinutes })}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted ">
            {t("drillsHeading")}
          </h2>
          {!canEdit && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-950 text-red-300">
              {t("locked")}
            </span>
          )}
        </div>
        {orderedDrills.length === 0 ? (
          <p className="text-sm text-muted ">
            {t("noDrills")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orderedDrills.map((drill, index) => (
              <DrillRow
                key={drill.id}
                sessionId={session.id}
                drill={drill}
                canEdit={canEdit}
                drillsByCategory={drillsByCategory}
                isFirst={index === 0}
                isLast={index === orderedDrills.length - 1}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
