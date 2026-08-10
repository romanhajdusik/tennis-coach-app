import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPlayer } from "@/lib/players/selected";
import { PlayerSwitcher } from "@/components/player-switcher";

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

/**
 * Kalendár sa otvára na TÝŽDNI. Mesačný zoznam pod mriežkou mal pri aktívnom
 * hráčovi bežne 30+ položiek a tréner v ňom nenašiel, čo ho zaujíma — čo je
 * dnes a čo najbližšie. Mesiac ostáva na jeden klik, je užitočný pri plánovaní
 * dopredu.
 */
const DEFAULT_VIEW: CalendarView = "week";

type CalendarView = "week" | "month";

/** Pondelok týždňa, do ktorého dátum patrí. */
function startOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function parseWeekParam(week: string | undefined) {
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    const [year, month, day] = week.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) return startOfWeek(parsed);
  }
  return startOfWeek(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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
  searchParams: Promise<{ month?: string; week?: string; view?: string }>;
}) {
  const { month, week, view: rawView } = await searchParams;
  const view: CalendarView =
    rawView === "month" || rawView === "week" ? rawView : DEFAULT_VIEW;
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

  const activePlayer = await getSelectedPlayer(supabase, user.id);

  const { year, monthIndex } = parseMonthParam(month);
  const monthStart = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = (monthStart.getDay() + 6) % 7; // pondelok = 0
  const weekStart = parseWeekParam(week);

  // Vykresľované okno — podľa neho sa obmedzí aj dotaz do databázy.
  const windowStart = view === "week" ? weekStart : monthStart;
  const windowEnd =
    view === "week" ? addDays(weekStart, 7) : new Date(year, monthIndex + 1, 1);

  // Dotaz je ohraničený na okno, nie na celú históriu hráča. Podmienka musí
  // brať OBA dátumy: tréning sa v zozname zobrazuje podľa `actual_data.date`,
  // a ak ho nemá, podľa `planned_data.date` — filtrovať len podľa jedného by
  // tréningy prekladané na iný deň buď stratilo, alebo pridalo navyše.
  // Okraje sú o dva dni širšie, aby posun pásma nezahodil krajný deň; presné
  // orezanie robí až porovnanie nižšie.
  const queryFrom = addDays(windowStart, -2).toISOString();
  const queryTo = addDays(windowEnd, 2).toISOString();

  const { data: sessions } = activePlayer
    ? await supabase
        .from("sessions")
        .select("id, status, planned_data, actual_data")
        .eq("player_id", activePlayer.id)
        .or(
          `and(planned_data->>date.gte.${queryFrom},planned_data->>date.lt.${queryTo}),` +
            `and(actual_data->>date.gte.${queryFrom},actual_data->>date.lt.${queryTo})`,
        )
    : { data: null };

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
    if (date < windowStart || date >= windowEnd) continue;
    const key = toDayKey(date);
    const list = sessionsByDay.get(key) ?? [];
    list.push({ id: session.id, status: session.status, date: dateValue });
    sessionsByDay.set(key, list);
  }

  const windowSessions = [...sessionsByDay.entries()]
    .flatMap(([, list]) => list)
    .sort((a, b) => a.date.localeCompare(b.date));

  const prevMonth = monthIndex === 0 ? { year: year - 1, monthIndex: 11 } : { year, monthIndex: monthIndex - 1 };
  const nextMonth = monthIndex === 11 ? { year: year + 1, monthIndex: 0 } : { year, monthIndex: monthIndex + 1 };

  const weekParam = (date: Date) => toDayKey(date);
  const prevHref =
    view === "week"
      ? `/calendar?view=week&week=${weekParam(addDays(weekStart, -7))}`
      : `/calendar?view=month&month=${monthParam(prevMonth.year, prevMonth.monthIndex)}`;
  const nextHref =
    view === "week"
      ? `/calendar?view=week&week=${weekParam(addDays(weekStart, 7))}`
      : `/calendar?view=month&month=${monthParam(nextMonth.year, nextMonth.monthIndex)}`;

  // Prepnutie pohľadu drží obdobie, na ktoré sa tréner práve pozerá — z týždňa
  // sa dostane na mesiac, v ktorom ten týždeň leží, a naopak.
  const weekHref = `/calendar?view=week&week=${weekParam(view === "week" ? weekStart : startOfWeek(monthStart))}`;
  const monthHref = `/calendar?view=month&month=${monthParam(
    view === "week" ? weekStart.getFullYear() : year,
    view === "week" ? weekStart.getMonth() : monthIndex,
  )}`;

  const weekLabel = `${format.dateTime(weekStart, { day: "numeric", month: "short" })} – ${format.dateTime(
    addDays(weekStart, 6),
    { day: "numeric", month: "short", year: "numeric" },
  )}`;

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

      <PlayerSwitcher />

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
            {Array.from({ length: view === "week" ? 7 : daysInMonth }).map(
              (_, index) => {
                const dayDate =
                  view === "week"
                    ? addDays(weekStart, index)
                    : new Date(year, monthIndex, index + 1);
                const key = toDayKey(dayDate);
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
                    {dayDate.getDate()}
                  </a>
                );
              },
            )}
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
