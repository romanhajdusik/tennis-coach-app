import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter, getTimeZone } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPlayer } from "@/lib/players/selected";
import { getLinkedPlayerId } from "@/lib/players/linked";
import { disciplineConfig, type DisciplineId } from "@/lib/discipline";
import { PlayerSwitcher } from "@/components/player-switcher";
import {
  LABEL_TIME_ZONE,
  addPlainDays,
  dayKeyIn,
  daysInMonth,
  isoWeek,
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

/**
 * Kalendár sa otvára na TÝŽDNI. Mesačný zoznam pod mriežkou mal pri aktívnom
 * hráčovi bežne 30+ položiek a tréner v ňom nenašiel, čo ho zaujíma — čo je
 * dnes a čo najbližšie. Mesiac ostáva na jeden klik, je užitočný pri plánovaní
 * dopredu.
 */
const DEFAULT_VIEW: CalendarView = "week";

type CalendarView = "week" | "month";

// Naplánované tréningy zelenou, dokončené červenou — ak má deň oboje,
// naplánovaný (ešte nadchádzajúci) vyhráva, nech si ho tréner nepremkne.
//
// **Cudzie tréningy (druhá disciplína) sa do farby dňa nerátajú.** Bodka
// v mriežke znamená „tu mám ja niečo s hráčom"; kondičný tréning by trénera
// pomýlil rovnako ako v „dňoch bez tréningu" v rosteri — vyzeralo by, že hráč
// bol na kurte, hoci bol na posilňovni. V zozname pod mriežkou ho vidí.
function dayStatus(daySessions: { status: string; isForeign: boolean }[]) {
  const own = daySessions.filter((session) => !session.isForeign);
  if (own.some((session) => session.status === "planned")) return "planned";
  if (own.some((session) => session.status === "completed")) return "completed";
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

  // Všetko dátumové sa počíta v pásme DIVÁKA (lib/calendar-window.ts) — inak
  // sa mriežka (pásmo servera) rozíde s nadpisom (pásmo diváka) o deň.
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

  // Dni vykresľovaného okna. Príslušnosť tréningu ku dňu sa porovnáva cez
  // kľúče `YYYY-MM-DD`, nie cez `Date` — deň je kalendárny pojem, nie okamih.
  const windowDays =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => addPlainDays(weekStart, index))
      : Array.from({ length: monthDayCount }, (_, index) => ({
          year,
          month: monthNumber,
          day: index + 1,
        }));
  const windowKeys = new Set(windowDays.map(plainDateKey));

  // Dotaz je ohraničený na okno, nie na celú históriu hráča. Podmienka musí
  // brať OBA dátumy: tréning sa v zozname zobrazuje podľa `actual_data.date`,
  // a ak ho nemá, podľa `planned_data.date` — filtrovať len podľa jedného by
  // tréningy prekladané na iný deň buď stratilo, alebo pridalo navyše.
  // Okraje sú o dva dni širšie, aby posun pásma nezahodil krajný deň; presné
  // orezanie robí až porovnanie kľúčov nižšie.
  const queryFrom = plainToUtcDate(
    addPlainDays(windowDays[0], -2),
  ).toISOString();
  const queryTo = plainToUtcDate(
    addPlainDays(windowDays[windowDays.length - 1], 2),
  ).toISOString();

  // Prepojenie kariet (docs §2.0, krok 4): v samostatnom režime je hráč u
  // druhého trénera INÁ karta, takže sa treba spýtať aj na ňu. Vo federácii je
  // to tá istá karta s dvoma priradeniami, takže `getLinkedPlayerId` nevráti
  // nič a cudziu disciplínu vydá RLS na tom istom `player_id`.
  const linkedPlayerId = activePlayer
    ? await getLinkedPlayerId(supabase, activePlayer.id)
    : null;
  const playerIds = activePlayer
    ? [activePlayer.id, ...(linkedPlayerId ? [linkedPlayerId] : [])]
    : [];

  const { data: sessions } = activePlayer
    ? await supabase
        .from("sessions")
        .select("id, status, planned_data, actual_data, discipline, coach_id")
        .in("player_id", playerIds)
        .or(
          `and(planned_data->>date.gte.${queryFrom},planned_data->>date.lt.${queryTo}),` +
            `and(actual_data->>date.gte.${queryFrom},actual_data->>date.lt.${queryTo})`,
        )
    : { data: null };

  const sessionsByDay = new Map<
    string,
    {
      id: string;
      status: string;
      date: string;
      discipline: string;
      isForeign: boolean;
    }[]
  >();
  for (const session of sessions ?? []) {
    const planned = session.planned_data as PlannedData | null;
    const actual = session.actual_data as ActualData | null;
    const dateValue = actual?.date ?? planned?.date;
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKeyIn(timeZone, date);
    if (!windowKeys.has(key)) continue;
    const list = sessionsByDay.get(key) ?? [];
    // **Cudzí = nie je môj, nie „má iný štítok".** Rozhoduje `coach_id`, teda
    // vlastníctvo, lebo presne to určuje aj RLS: upraviť smiem len tréning,
    // kde som `coach_id`. Štítok disciplíny na to nestačí — tréning
    // z prepojenej karty môže niesť moju disciplínu (starý záznam, zápis cez
    // API) a tváril by sa ako môj: plný rámček, odkaz na editovateľnú
    // stránku a tlačidlá, ktoré server zamietne. Zistené auditom 2026-08-15.
    //
    // Vo federácii to vychádza rovnako: hráč má jednu kartu, ale tréning
    // druhej disciplíny zapísal druhý tréner, takže `coach_id` je jeho.
    // Štítok ostáva na to, ČO sa vypíše („Fitness"), nie na to, či je cudzí.
    list.push({
      id: session.id,
      status: session.status,
      date: dateValue,
      discipline: session.discipline,
      isForeign: session.coach_id !== user.id,
    });
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
      ? `/calendar?view=week&week=${plainDateKey(addPlainDays(weekStart, -7))}`
      : `/calendar?view=month&month=${monthParam(prevMonthAnchor.year, prevMonthAnchor.month)}`;
  const nextHref =
    view === "week"
      ? `/calendar?view=week&week=${plainDateKey(addPlainDays(weekStart, 7))}`
      : `/calendar?view=month&month=${monthParam(nextMonthAnchor.year, nextMonthAnchor.month)}`;

  // Prepnutie pohľadu drží obdobie, na ktoré sa tréner práve pozerá — z týždňa
  // sa dostane na mesiac, v ktorom ten týždeň leží, a naopak.
  const weekHref = `/calendar?view=week&week=${plainDateKey(
    view === "week" ? weekStart : startOfWeek(monthAnchor),
  )}`;
  const monthHref = `/calendar?view=month&month=${monthParam(
    view === "week" ? weekStart.year : year,
    view === "week" ? weekStart.month : monthNumber,
  )}`;

  // Nadpisy sa formátujú s `timeZone: "UTC"` — dátum je tu kalendárny deň,
  // nie okamih, takže ho next-intl nesmie prekladať do pásma diváka.
  const monthLabel = format.dateTime(plainToUtcDate(monthAnchor), {
    month: "long",
    year: "numeric",
    timeZone: LABEL_TIME_ZONE,
  });
  // Hlavný údaj je číslo ISO týždňa — rovnaké číslovanie ako v analytike,
  // takže si tréner vie týždeň spárovať. Rozsah dátumov ostáva pod ním
  // drobným písmom: mriežka pod nadpisom ukazuje len čísla dní, takže pri
  // týždni na prelome mesiacov by inak nebolo vidieť, o ktoré mesiace ide.
  const { year: isoYear, week: isoWeekNumber } = isoWeek(weekStart);
  const weekLabel = t("weekLabel", { week: isoWeekNumber, year: isoYear });
  const weekRangeLabel = `${format.dateTime(plainToUtcDate(weekStart), {
    day: "numeric",
    month: "short",
    timeZone: LABEL_TIME_ZONE,
  })} – ${format.dateTime(plainToUtcDate(addPlainDays(weekStart, 6)), {
    day: "numeric",
    month: "short",
    timeZone: LABEL_TIME_ZONE,
  })}`;

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
            <div className="flex flex-col items-center">
              <p className="text-sm font-medium capitalize text-foreground ">
                {view === "week" ? weekLabel : monthLabel}
              </p>
              {view === "week" && (
                <p className="text-xs text-muted">{weekRangeLabel}</p>
              )}
            </div>
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
                  {dayDate.day}
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
                    {/* Cudzí tréning vedie na READ-ONLY detail, nie na
                        editovateľný `/sessions/[id]` — nie je trénerov a
                        zapisovacie policy by ho aj tak odmietli. Odlíšený je
                        prerušovaným rámčekom: stavové farby (zelená/červená)
                        sú obsadené a druhá výplň by v mriežke aj v zozname
                        súperila s tým, čo tréner reálne robí. */}
                    <Link
                      href={
                        session.isForeign
                          ? `/linked-sessions/${session.id}`
                          : `/sessions/${session.id}`
                      }
                      className={`flex items-center justify-between rounded-xl border bg-surface p-4 ${
                        session.isForeign
                          ? "border-dashed border-border"
                          : (CARD_BORDER_CLASSES[session.status] ?? "border-border")
                      }`}
                    >
                      <p className="font-medium text-foreground ">
                        {format.dateTime(new Date(session.date), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {session.isForeign ? (
                        <span className="text-xs font-medium text-muted">
                          {disciplineConfig(
                            session.discipline as DisciplineId,
                          ).label}
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-medium ${
                            STATUS_TEXT_CLASSES[session.status] ??
                            "text-muted "
                          }`}
                        >
                          {tCommon(`status.${session.status}`)}
                        </span>
                      )}
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
