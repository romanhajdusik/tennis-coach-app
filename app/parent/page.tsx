import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter, getTimeZone } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import {
  LABEL_TIME_ZONE,
  addPlainDays,
  dayKeyIn,
  daysInMonth,
  plainToUtcDate,
  todayIn,
} from "@/lib/calendar-window";
import { ConnectForm } from "./connect-form";

type PlannedData = { date?: string };
type ActualData = { date?: string };

// Zoznam tréningov rodiča/hráča/manažéra. **Toto je bezplatná časť** jeho
// appky (docs/cennik-navrh.md §8.3): zoznam s filtrom na mesiac a detail
// tréningu má aj bez predplatného, za platbu ide kalendár a analytika.
// Preto musí byť zoznam sám o sebe použiteľný — filter na mesiac tu nie je
// ozdoba, ale podmienka toho, aby sa v ňom po dvoch sezónach dalo niečo nájsť.
//
// Dotaz je **ohraničený oknom**, nie na celú históriu: predvolene posledných
// 12 mesiacov (a všetko naplánované dopredu), inak vybraný mesiac. Bez toho
// narazí dlhá história na `max_rows` PostgRESTu — tá istá pasca, akú kalendár
// aj roster už riešia oknom.
const RECENT_DAYS = 365;

// Tvrdý strop pre prípad, že aj v okne je záznamov priveľa (rok tréningov
// päťkrát do týždňa). Poradie v dotaze je zostupné, takže sa oreže to
// najstaršie a nie náhodné riadky.
const LIST_LIMIT = 200;

function monthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const t = await getTranslations("Parent.dashboard");
  const tCommon = await getTranslations("Common");
  const tCalendar = await getTranslations("Calendar");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  const { data: connection } = await supabase
    .from("player_connections")
    .select("id, players(name)")
    .eq("parent_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const connectedPlayerName = (
    connection?.players as { name: string } | null
  )?.name;

  // Dátumová aritmetika v pásme diváka — rovnako ako v kalendári
  // (lib/calendar-window.ts vysvetľuje prečo).
  const timeZone = await getTimeZone();
  const today = todayIn(timeZone);
  const monthAnchor = /^\d{4}-\d{2}$/.test(month ?? "")
    ? {
        year: Number(month!.split("-")[0]),
        month: Number(month!.split("-")[1]),
        day: 1,
      }
    : null;

  // Okraje sú o dva dni širšie kvôli pásmu — presné orezanie na mesiac robí
  // až porovnanie dňových kľúčov nižšie (ako v kalendári).
  const windowFrom = plainToUtcDate(
    addPlainDays(monthAnchor ?? today, monthAnchor ? -2 : -RECENT_DAYS),
  ).toISOString();
  const windowTo = monthAnchor
    ? plainToUtcDate(
        addPlainDays(
          {
            ...monthAnchor,
            day: daysInMonth(monthAnchor.year, monthAnchor.month),
          },
          3,
        ),
      ).toISOString()
    : null;

  // Naplánované tréningy ostávajú v bezplatnom zozname zámerne — rodič, ktorý
  // nevie, kedy má dieťa tréning, otravuje trénera, a tomu má appka
  // predchádzať. Predvolené okno preto nemá hornú hranicu.
  const dateFilter = windowTo
    ? `and(planned_data->>date.gte.${windowFrom},planned_data->>date.lt.${windowTo}),` +
      `and(actual_data->>date.gte.${windowFrom},actual_data->>date.lt.${windowTo})`
    : `planned_data->>date.gte.${windowFrom},actual_data->>date.gte.${windowFrom}`;

  const { data: records } = connection
    ? await supabase
        .from("parent_session_records")
        .select("id, status, planned_data, actual_data")
        .eq("parent_id", user.id)
        .or(dateFilter)
        .order("planned_data->>date", { ascending: false })
        .limit(LIST_LIMIT)
    : { data: null };

  const monthKey = monthAnchor
    ? monthParam(monthAnchor.year, monthAnchor.month)
    : null;

  const sessions = (records ?? [])
    .map((record) => {
      const planned = record.planned_data as PlannedData | null;
      const actual = record.actual_data as ActualData | null;
      return { ...record, date: actual?.date ?? planned?.date };
    })
    .filter((session) => {
      if (!monthKey) return true;
      if (!session.date) return false;
      const date = new Date(session.date);
      if (Number.isNaN(date.getTime())) return false;
      return dayKeyIn(timeZone, date).startsWith(monthKey);
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const truncated = (records?.length ?? 0) >= LIST_LIMIT;

  const prevMonthAnchor = addPlainDays(monthAnchor ?? today, -1);
  const nextMonthAnchor = monthAnchor
    ? addPlainDays(
        {
          ...monthAnchor,
          day: daysInMonth(monthAnchor.year, monthAnchor.month),
        },
        1,
      )
    : today;

  // Nadpis je kalendárny mesiac, nie okamih — formátuje sa v UTC, aby ho
  // next-intl neposunul do pásma diváka.
  const monthLabel = monthAnchor
    ? format.dateTime(plainToUtcDate(monthAnchor), {
        month: "long",
        year: "numeric",
        timeZone: LABEL_TIME_ZONE,
      })
    : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <form action={logout.bind(null, "/parent/login")}>
          <button
            type="submit"
            className="text-sm font-medium text-muted underline "
          >
            {t("logout")}
          </button>
        </form>
      </div>

      {!connection ? (
        <ConnectForm />
      ) : (
        <>
          <p className="text-sm text-muted ">
            {t("connectedTo", { name: connectedPlayerName ?? "" })}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/parent/calendar"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
            >
              {t("calendar")}
            </Link>
            <Link
              href="/parent/analytics/Forehand"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
            >
              {t("analytics")}
            </Link>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted ">
              {t("sessionsHeading")}
            </h2>

            {monthAnchor ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-1.5">
                <Link
                  href={`/parent?month=${monthParam(prevMonthAnchor.year, prevMonthAnchor.month)}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  {tCalendar("prev")}
                </Link>
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {monthLabel}
                </span>
                <Link
                  href={`/parent?month=${monthParam(nextMonthAnchor.year, nextMonthAnchor.month)}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  {tCalendar("next")}
                </Link>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted">
                {monthAnchor ? monthLabel : t("recentRange")}
              </span>
              {monthAnchor ? (
                <Link
                  href="/parent"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {t("showRecent")}
                </Link>
              ) : (
                <Link
                  href={`/parent?month=${monthParam(today.year, today.month)}`}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {t("browseByMonth")}
                </Link>
              )}
            </div>

            {sessions.length === 0 ? (
              <p className="text-sm text-muted ">
                {monthAnchor ? t("noSessionsInMonth") : t("noSessions")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/parent/sessions/${session.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 "
                    >
                      <p className="font-medium text-foreground ">
                        {session.date
                          ? format.dateTime(new Date(session.date), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </p>
                      <span className="text-xs font-medium text-muted ">
                        {tCommon(`status.${session.status}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {truncated ? (
              <p className="text-xs text-muted">
                {t("listTruncated", { count: LIST_LIMIT })}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
