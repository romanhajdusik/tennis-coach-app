import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDiscipline,
  disciplineConfig,
  type DisciplineId,
} from "@/lib/discipline";

type PlannedData = { date?: string };
type ActualData = { date?: string };

// Tie isté farby ako u trénera (app/sessions/[id]/drill-row.tsx), u pultu aj
// u rodiča — kto tréning číta, má ho vidieť odlíšený rovnako ako ten, kto ho
// zapísal.
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

/**
 * Read-only detail tréningu z DRUHEJ disciplíny (docs §2.0, krok 4) — živý
 * pohľad cez RLS, bez jediného editačného prvku.
 *
 * Prístup nestráži táto stránka, ale RLS: v samostatnom režime `sessions_linked_select`
 * (aktívne prepojenie kariet), vo federácii `sessions_org_select` (spoločné
 * priradenie hráča). Kto naň nemá právo, dostane `notFound()` — dotaz mu
 * jednoducho nevráti riadok.
 *
 * **Konfigurácia sa berie zo ŠTÍTKU TRÉNINGU, nie z appky.** Tenisová appka
 * tu vykresľuje kondičný tréning, takže by inak hľadala charakter úderu tam,
 * kde sa nezaznamenáva — `getDisciplineConfig()` by vrátila tenis.
 */
export default async function LinkedSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("Sessions.linked");
  const tSessions = await getTranslations("Sessions");
  const tDrillRow = await getTranslations("Sessions.drillRow");
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
    .select("id, status, planned_data, actual_data, notes, discipline, coach_id")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    notFound();
  }

  // Vlastný tréning sem nepatrí — má svoju editovateľnú stránku a tréner by
  // na nej inak uviazol v read-only pohľade bez tlačidiel.
  if (session.coach_id === user.id || session.discipline === (await getDiscipline())) {
    redirect(`/sessions/${session.id}`);
  }

  const foreign = disciplineConfig(session.discipline as DisciplineId);

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
        <h1 className="text-xl font-semibold text-foreground">
          {t("heading", { discipline: foreign.label })}
        </h1>
        <Link
          href="/calendar"
          className="text-sm font-medium text-muted underline"
        >
          {tCommon("back")}
        </Link>
      </div>

      {/* Prerušovaný rámček je ten istý signál ako v kalendári: toto nie je
          tvoj tréning. Text pod ním hovorí, čo to znamená v praxi. */}
      <div className="rounded-xl border border-dashed border-border bg-surface p-4">
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
        <p className="mt-2 text-xs text-muted">
          {t("readOnlyNote", { discipline: foreign.label })}
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
                  {/* Charakter úderu má len tenis. Pri kondičnom tréningu je
                      `character` NULL aj `foreign.character` null, takže sa
                      riadok nevykreslí — nie prázdny popis. */}
                  {foreign.character && drill.character && (
                    <p className="text-sm text-muted">
                      {foreign.character.labels[drill.character] ??
                        drill.character}
                    </p>
                  )}
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
