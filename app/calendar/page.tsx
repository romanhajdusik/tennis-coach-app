import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

type PlannedData = { date?: string };
type ActualData = { date?: string };

function toDayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseMonthParam(month: string | undefined) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split("-").map(Number);
    return { year, monthIndex: monthNumber - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function monthParam(year: number, monthIndex: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(monthIndex + 1)}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const t = await getTranslations("Calendar");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const weekdays = t.raw("weekdays") as string[];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: activePlayer } = await supabase
    .from("players")
    .select("id, name")
    .eq("coach_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const { data: sessions } = activePlayer
    ? await supabase
        .from("sessions")
        .select("id, status, planned_data, actual_data")
        .eq("player_id", activePlayer.id)
    : { data: null };

  const { year, monthIndex } = parseMonthParam(month);
  const monthStart = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = (monthStart.getDay() + 6) % 7; // pondelok = 0

  const sessionsByDay = new Map<
    string,
    { id: string; status: string; date: string }[]
  >();
  for (const session of sessions ?? []) {
    const planned = session.planned_data as PlannedData | null;
    const actual = session.actual_data as ActualData | null;
    const dateValue = actual?.date ?? planned?.date;
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex) continue;
    const key = toDayKey(date);
    const list = sessionsByDay.get(key) ?? [];
    list.push({ id: session.id, status: session.status, date: dateValue });
    sessionsByDay.set(key, list);
  }

  const monthSessions = [...sessionsByDay.entries()]
    .flatMap(([, list]) => list)
    .sort((a, b) => a.date.localeCompare(b.date));

  const prevMonth = monthIndex === 0 ? { year: year - 1, monthIndex: 11 } : { year, monthIndex: monthIndex - 1 };
  const nextMonth = monthIndex === 11 ? { year: year + 1, monthIndex: 0 } : { year, monthIndex: monthIndex + 1 };

  const monthLabel = format.dateTime(monthStart, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          {tCommon("back")}
        </Link>
      </div>

      {!activePlayer ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t.rich("noActivePlayer", {
            link: (chunks) => (
              <Link href="/players" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Link
              href={`/calendar?month=${monthParam(prevMonth.year, prevMonth.monthIndex)}`}
              className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              {t("prev")}
            </Link>
            <p className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-50">
              {monthLabel}
            </p>
            <Link
              href={`/calendar?month=${monthParam(nextMonth.year, nextMonth.monthIndex)}`}
              className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              {t("next")}
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {weekdays.map((label) => (
              <div key={label} className="py-1 font-medium">
                {label}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const dayNumber = index + 1;
              const key = toDayKey(new Date(year, monthIndex, dayNumber));
              const daySessions = sessionsByDay.get(key) ?? [];
              const hasSessions = daySessions.length > 0;
              return (
                <a
                  key={key}
                  href={hasSessions ? `#day-${key}` : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-sm ${
                    hasSessions
                      ? "bg-zinc-900 font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {dayNumber}
                </a>
              );
            })}
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t("monthSessionsHeading")}
            </h2>
            {monthSessions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t("noSessionsInMonth")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {monthSessions.map((session) => (
                  <li key={session.id} id={`day-${toDayKey(new Date(session.date))}`}>
                    <Link
                      href={`/sessions/${session.id}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {format.dateTime(new Date(session.date), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {tCommon(`status.${session.status}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
