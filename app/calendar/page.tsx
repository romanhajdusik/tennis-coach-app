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

// Naplánované tréningy zelenou, dokončené červenou — ak má deň oboje,
// naplánovaný (ešte nadchádzajúci) vyhráva, nech si ho tréner nepremkne.
function dayStatus(daySessions: { status: string }[]) {
  if (daySessions.some((session) => session.status === "planned")) return "planned";
  if (daySessions.some((session) => session.status === "completed")) return "completed";
  return null;
}

const DAY_DOT_CLASSES: Record<string, string> = {
  planned: "font-medium bg-emerald-500 text-emerald-950",
  completed: "font-medium bg-red-500 text-red-950",
};

const STATUS_TEXT_CLASSES: Record<string, string> = {
  planned: " text-emerald-400",
  completed: " text-red-400",
};

// Rámček karty tréningu v zozname podľa stavu — dokončený červený,
// naplánovaný zelený (ostatné stavy neutrálny sivý).
const CARD_BORDER_CLASSES: Record<string, string> = {
  planned: "border-emerald-500",
  completed: "border-red-500",
};

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
        <h1 className="text-xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-muted underline "
        >
          {tCommon("back")}
        </Link>
      </div>

      {!activePlayer ? (
        <p className="text-sm text-muted ">
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
              className="text-sm font-medium text-muted underline "
            >
              {t("prev")}
            </Link>
            <p className="text-sm font-medium capitalize text-foreground ">
              {monthLabel}
            </p>
            <Link
              href={`/calendar?month=${monthParam(nextMonth.year, nextMonth.monthIndex)}`}
              className="text-sm font-medium text-muted underline "
            >
              {t("next")}
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted ">
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
              const status = dayStatus(daySessions);
              return (
                <a
                  key={key}
                  href={hasSessions ? `#day-${key}` : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-sm ${
                    status
                      ? DAY_DOT_CLASSES[status]
                      : "text-foreground "
                  }`}
                >
                  {dayNumber}
                </a>
              );
            })}
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted ">
              {t("monthSessionsHeading")}
            </h2>
            {monthSessions.length === 0 ? (
              <p className="text-sm text-muted ">
                {t("noSessionsInMonth")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {monthSessions.map((session) => (
                  <li key={session.id} id={`day-${toDayKey(new Date(session.date))}`}>
                    <Link
                      href={`/sessions/${session.id}`}
                      className={`flex items-center justify-between rounded-xl border ${
                        CARD_BORDER_CLASSES[session.status] ?? "border-border"
                      } bg-surface p-4`}
                    >
                      <p className="font-medium text-foreground ">
                        {format.dateTime(new Date(session.date), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          STATUS_TEXT_CLASSES[session.status] ??
                          "text-muted "
                        }`}
                      >
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
