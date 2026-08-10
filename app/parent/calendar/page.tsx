import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter, getTimeZone } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  LABEL_TIME_ZONE,
  addPlainDays,
  dayKeyIn,
  daysInMonth,
  parsePlainDate,
  plainDateKey,
  plainToUtcDate,
  startOfWeek,
  todayIn,
  weekdayIndex,
} from "@/lib/calendar-window";

type PlannedData = { date?: string };
type ActualData = { date?: string };

function monthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

type CalendarView = "week" | "month";

/** Rovnaký predvolený pohľad ako u trénera — zoznam za celý mesiac je pridlhý. */
const DEFAULT_VIEW: CalendarView = "week";

// Naplánované tréningy zelenou, dokončené červenou — ak má deň oboje,
// naplánovaný (ešte nadchádzajúci) vyhráva, rovnaký princíp ako u trénera.
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

export default async function ParentCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; week?: string; view?: string }>;
}) {
  const { month, week, view: rawView } = await searchParams;
  const view: CalendarView =
    rawView === "month" || rawView === "week" ? rawView : DEFAULT_VIEW;
  const t = await getTranslations("Calendar");
  const tCommon = await getTranslations("Common");
  const tParent = await getTranslations("Parent.calendar");
  const format = await getFormatter();
  const weekdays = t.raw("weekdays") as string[];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  const { data: connection } = await supabase
    .from("player_connections")
    .select("id")
    .eq("parent_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  // Dátumová aritmetika v pásme diváka — rovnako ako v trénerovom kalendári
  // (lib/calendar-window.ts vysvetľuje prečo).
  const timeZone = await getTimeZone();
  const today = todayIn(timeZone);

  const monthAnchor = /^\d{4}-\d{2}$/.test(month ?? "")
    ? {
        year: Number(month!.split("-")[0]),
        month: Number(month!.split("-")[1]),
        day: 1,
      }
    : { year: today.year, month: today.month, day: 1 };
  const { year, month: monthNumber } = monthAnchor;
  const monthDayCount = daysInMonth(year, monthNumber);
  const leadingBlanks = weekdayIndex(monthAnchor);
  const weekStart = startOfWeek(parsePlainDate(week) ?? today);

  const windowDays =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => addPlainDays(weekStart, index))
      : Array.from({ length: monthDayCount }, (_, index) => ({
          year,
          month: monthNumber,
          day: index + 1,
        }));
  const windowKeys = new Set(windowDays.map(plainDateKey));

  // Ohraničené na okno, nie na celú históriu. Podmienka berie oba dátumy —
  // tréning sa zobrazuje podľa `actual_data.date`, a ak ho nemá, podľa
  // plánovaného; okraje sú širšie o dva dni kvôli pásmu, presné orezanie robí
  // až porovnanie kľúčov nižšie. (Rovnako ako v trénerovom kalendári.)
  const queryFrom = plainToUtcDate(
    addPlainDays(windowDays[0], -2),
  ).toISOString();
  const queryTo = plainToUtcDate(
    addPlainDays(windowDays[windowDays.length - 1], 2),
  ).toISOString();

  const { data: records } = connection
    ? await supabase
        .from("parent_session_records")
        .select("id, status, planned_data, actual_data")
        .eq("parent_id", user.id)
        .or(
          `and(planned_data->>date.gte.${queryFrom},planned_data->>date.lt.${queryTo}),` +
            `and(actual_data->>date.gte.${queryFrom},actual_data->>date.lt.${queryTo})`,
        )
    : { data: null };

  const sessionsByDay = new Map<
    string,
    { id: string; status: string; date: string }[]
  >();
  for (const record of records ?? []) {
    const planned = record.planned_data as PlannedData | null;
    const actual = record.actual_data as ActualData | null;
    const dateValue = actual?.date ?? planned?.date;
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKeyIn(timeZone, date);
    if (!windowKeys.has(key)) continue;
    const list = sessionsByDay.get(key) ?? [];
    list.push({ id: record.id, status: record.status, date: dateValue });
    sessionsByDay.set(key, list);
  }

  const windowSessions = [...sessionsByDay.entries()]
    .flatMap(([, list]) => list)
    .sort((a, b) => a.date.localeCompare(b.date));

  const prevMonthAnchor = addPlainDays(monthAnchor, -1);
  const nextMonthAnchor = addPlainDays(
    { year, month: monthNumber, day: monthDayCount },
    1,
  );

  const prevHref =
    view === "week"
      ? `/parent/calendar?view=week&week=${plainDateKey(addPlainDays(weekStart, -7))}`
      : `/parent/calendar?view=month&month=${monthParam(prevMonthAnchor.year, prevMonthAnchor.month)}`;
  const nextHref =
    view === "week"
      ? `/parent/calendar?view=week&week=${plainDateKey(addPlainDays(weekStart, 7))}`
      : `/parent/calendar?view=month&month=${monthParam(nextMonthAnchor.year, nextMonthAnchor.month)}`;

  const weekHref = `/parent/calendar?view=week&week=${plainDateKey(
    view === "week" ? weekStart : startOfWeek(monthAnchor),
  )}`;
  const monthHref = `/parent/calendar?view=month&month=${monthParam(
    view === "week" ? weekStart.year : year,
    view === "week" ? weekStart.month : monthNumber,
  )}`;

  // Nadpisy sú kalendárne dni, nie okamihy — formátujú sa v UTC, aby ich
  // next-intl neposunul do pásma diváka.
  const monthLabel = format.dateTime(plainToUtcDate(monthAnchor), {
    month: "long",
    year: "numeric",
    timeZone: LABEL_TIME_ZONE,
  });
  const weekLabel = `${format.dateTime(plainToUtcDate(weekStart), {
    day: "numeric",
    month: "short",
    timeZone: LABEL_TIME_ZONE,
  })} – ${format.dateTime(plainToUtcDate(addPlainDays(weekStart, 6)), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LABEL_TIME_ZONE,
  })}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <Link
          href="/parent"
          className="text-sm font-medium text-muted underline "
        >
          {tParent("back")}
        </Link>
      </div>

      {!connection ? (
        <p className="text-sm text-muted ">
          {tParent("noConnection")}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <Link
              href={weekHref}
              className={
                view === "week"
                  ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground"
              }
            >
              {t("viewWeek")}
            </Link>
            <Link
              href={monthHref}
              className={
                view === "month"
                  ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground"
              }
            >
              {t("viewMonth")}
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <Link
              href={prevHref}
              className="text-sm font-medium text-muted underline "
            >
              {t("prev")}
            </Link>
            <p className="text-sm font-medium capitalize text-foreground ">
              {view === "week" ? weekLabel : monthLabel}
            </p>
            <Link
              href={nextHref}
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
            {view === "month" &&
              Array.from({ length: leadingBlanks }).map((_, index) => (
                <div key={`blank-${index}`} />
              ))}
            {windowDays.map((dayDate) => {
              const dayNumber = dayDate.day;
              const key = plainDateKey(dayDate);
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
              {view === "week"
                ? t("weekSessionsHeading")
                : t("monthSessionsHeading")}
            </h2>
            {windowSessions.length === 0 ? (
              <p className="text-sm text-muted ">
                {view === "week" ? t("noSessionsInWeek") : t("noSessionsInMonth")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {windowSessions.map((session) => (
                  <li
                    key={session.id}
                    id={`day-${dayKeyIn(timeZone, new Date(session.date))}`}
                  >
                    <Link
                      href={`/parent/sessions/${session.id}`}
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
