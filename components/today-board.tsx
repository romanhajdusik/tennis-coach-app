import Link from "next/link";
import { getTranslations, getFormatter, getTimeZone } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { selectPlayerAndOpen } from "@/lib/actions/selected-player";
import {
  getRosterOverview,
  getSessionFocus,
  PRACTICE_LOOKBACK_DAYS,
  type RosterEntry,
  type ScheduledSession,
} from "@/lib/players/roster";
import { getActivePlayers } from "@/lib/players/selected";
import { SummaryTile } from "@/components/roster-status";
import type { OrgContext } from "@/lib/org/context";

// Ľavý rámček karty tréningu podľa stavu — rovnaká konvencia ako v kalendári.
const SESSION_BORDER_CLASSES: Record<string, string> = {
  planned: "border-l-emerald-500",
  completed: "border-l-red-500",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  planned: "bg-emerald-950 text-emerald-300",
  completed: "bg-red-950 text-red-300",
};

/**
 * „Dnes" — denný domov trénera s viacerými hráčmi: rozvrh dňa **naprieč
 * všetkými hráčmi** v poradí podľa času, plus upozornenie na toho, kto
 * najdlhšie netrénoval.
 *
 * Vykresľuje sa vždy, keď má tréner **2+ aktívnych hráčov** — federačnému
 * (1:N) aj samostatnému, ktorý si zaplatil vyššiu cenovú hladinu. S jediným
 * hráčom nemá čo zoraďovať, tam ostáva pôvodný rozcestník.
 *
 * `org` je nepovinná: v jej názve sa líši len podnadpis. Samostatný tréner
 * žiadnu organizáciu nemá, takže sa doplnok bez nej vynechá.
 *
 * Ťuknutie na tréning zároveň **prepne vybraného hráča**, inak by appka na
 * ďalšej obrazovke ukazovala dáta niekoho iného.
 */
export async function TodayBoard({ org }: { org?: OrgContext | null }) {
  const t = await getTranslations("Today");
  const format = await getFormatter();
  const timeZone = await getTimeZone();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const now = new Date();
  const players = await getActivePlayers(supabase, user.id);
  const overview = await getRosterOverview(supabase, players, timeZone, now);
  const focus = await getSessionFocus(
    supabase,
    [...overview.today, ...overview.tomorrow].map((session) => session.id),
  );

  // „Ešte nasleduje" = naplánovaný a časovo ešte pred nami; ráno zaznamenaný
  // tréning, ktorý tréner popoludní ešte neuzavrel, už nie je čo očakávať.
  const upcomingToday = overview.today.filter(
    (session) =>
      session.status === "planned" && Date.parse(session.date) > now.getTime(),
  ).length;

  // Do upozornenia ide ten najzanedbanejší: najprv hráč bez zaznamenaného
  // tréningu, potom ten s najväčším počtom dní.
  const nudged = overview.entries
    .filter((entry) => entry.attention !== "ok")
    .sort(
      (a, b) =>
        (b.daysSincePractice ?? Number.MAX_SAFE_INTEGER) -
        (a.daysSincePractice ?? Number.MAX_SAFE_INTEGER),
    )
    .at(0);

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted">
          {format.dateTime(now, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {org && ` · ${org.name}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryTile
          value={overview.today.length}
          label={t("summary.sessions")}
        />
        <SummaryTile value={upcomingToday} label={t("summary.upcoming")} />
        <SummaryTile
          value={overview.attentionCount}
          label={t("summary.attention")}
          highlight={overview.attentionCount > 0}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {t("scheduleHeading")}
        </h2>
        {overview.today.length === 0 ? (
          <p className="text-sm text-muted">{t("noSessionsToday")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.today.map((session) => (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  categories={focus.get(session.id) ?? []}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {nudged && <Nudge entry={nudged} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {t("tomorrowHeading")}
        </h2>
        {overview.tomorrow.length === 0 ? (
          <p className="text-sm text-muted">{t("noSessionsTomorrow")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.tomorrow.map((session) => (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  categories={focus.get(session.id) ?? []}
                  muted
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/players"
        className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-medium text-foreground"
      >
        {t("rosterLink")}
      </Link>
    </div>
  );
}

async function SessionRow({
  session,
  categories,
  muted,
}: {
  session: ScheduledSession;
  categories: string[];
  muted?: boolean;
}) {
  const t = await getTranslations("Today");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();

  const detail = [
    categories.length > 0 ? categories.join(" · ") : t("noFocus"),
    session.durationMinutes
      ? t("duration", { minutes: session.durationMinutes })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <form
      action={selectPlayerAndOpen.bind(
        null,
        session.playerId,
        `/sessions/${session.id}`,
      )}
    >
      <button
        type="submit"
        aria-label={t("openSession", { name: session.playerName })}
        className={`flex w-full items-center gap-3 rounded-xl border border-l-4 border-border bg-surface p-3 text-left ${
          muted ? "" : (SESSION_BORDER_CLASSES[session.status] ?? "")
        }`}
      >
        {/* Pevná šírka zarovná časy pod sebou; 12-hodinový formát („1:27 PM")
            sa do užšieho stĺpca nezmestí a zalamoval by sa. */}
        <span className="w-[4.75rem] flex-none whitespace-nowrap text-sm font-semibold text-foreground">
          {format.dateTime(new Date(session.date), { timeStyle: "short" })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {session.playerName}
          </span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_BADGE_CLASSES[session.status] ?? "bg-surface text-muted"
          }`}
        >
          {tCommon(`status.${session.status}`)}
        </span>
      </button>
    </form>
  );
}

async function Nudge({ entry }: { entry: RosterEntry }) {
  const t = await getTranslations("Today");

  return (
    <form action={selectPlayerAndOpen.bind(null, entry.player.id, "/sessions")}>
      <button
        type="submit"
        aria-label={t("nudge.open", { name: entry.player.name })}
        className="flex w-full flex-col gap-0.5 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-left"
      >
        <span className="text-sm font-medium text-amber-200">
          {entry.daysSincePractice === null
            ? t("nudge.never", {
                name: entry.player.name,
                days: PRACTICE_LOOKBACK_DAYS,
              })
            : t("nudge.days", {
                name: entry.player.name,
                days: entry.daysSincePractice,
              })}
        </span>
        <span className="text-xs text-amber-300/80">{t("nudge.action")}</span>
      </button>
    </form>
  );
}
