import Link from "next/link";
import { getTranslations, getFormatter, getTimeZone } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { selectPlayerAndOpen } from "@/lib/actions/selected-player";
import { getRosterOverview, type ScheduledSession } from "@/lib/players/roster";
import { getActivePlayers, getSelectedPlayer } from "@/lib/players/selected";
import { getDiscipline, getDisciplineConfig } from "@/lib/discipline";
import {
  getDefaultPeriodValue,
  getPeriodRange,
  getPlayerCategoryMinuteShares,
} from "@/lib/actions/analytics";
import { CategoryShareChart } from "@/app/analytics/[category]/category-share-chart";
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
 * „Dnes" — denný domov trénera: rozvrh dňa a zajtrajška
 * **naprieč všetkými hráčmi** v poradí podľa času.
 *
 * **Upozornenie „hráč netrénuje" tu zámerne NIE JE** (od 2026-09-21, rozhodol
 * používateľ): tréner svojich hráčov pozná a nepotrebuje to vidieť pri každom
 * otvorení appky; kto to naozaj potrebuje, je šéftréner organizácie (pult
 * `/director`). Stav každého hráča ostáva v zozname na `/players`.
 *
 * **Dlaždice so súčtami (tréningy dnes, koľko ešte čaká) tu tiež nie sú**
 * (od 2026-09-21) — len opakovali rozvrh, ktorý je hneď pod nimi.
 *
 * Od 2026-09-21 ju dostane **každý tréner**, aj s jediným hráčom — dovtedy
 * len tréner s 2+ hráčmi; ostatní videli rozcestník s tlačidlami, ktoré sú
 * odvtedy v spodnej lište. Kedy sa nevykreslí, rozhoduje `app/page.tsx`.
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
  // Vlastná disciplína: nástenka je o tom, čo má tréner dnes robiť, nie
  // o tom, čo s hráčom robí kolega z druhej disciplíny.
  const overview = await getRosterOverview(
    supabase,
    players,
    timeZone,
    await getDiscipline(),
    now,
  );

  // Posledný odtrénovaný naprieč hráčmi — nástenka je rozvrh dňa, takže aj
  // náhrada za prázdny deň musí byť „čo bolo naposledy", nie jeden vybraný hráč.
  const lastSession =
    overview.entries
      .map((entry) => entry.lastSession)
      .filter((session): session is ScheduledSession => session !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1) ?? null;

  // Generálny graf sa viaže na VYBRANÉHO hráča (graf je vždy o jednom), na
  // rozdiel od rozvrhu nad ním.
  const discipline = await getDiscipline();
  const config = await getDisciplineConfig();
  const selected = await getSelectedPlayer(supabase, user.id);
  const { start, end } = await getPeriodRange(
    "last12",
    getDefaultPeriodValue("last12"),
  );
  const shares = selected
    ? await getPlayerCategoryMinuteShares(
        supabase,
        selected.id,
        start,
        end,
        discipline,
      )
    : [];
  const analyticsHref = `/analytics/${encodeURIComponent(config.categories[0])}`;
  const showChart = overview.tomorrow.length === 0 && shares.length > 0;

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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {overview.today.length === 0 && lastSession
            ? t("lastPracticeHeading")
            : t("scheduleHeading")}
        </h2>
        {overview.today.length === 0 ? (
          // Deň bez tréningu nechával obrazovku prázdnu (používateľ,
          // 2026-09-24) — namiesto hlášky sa ukáže posledný odtrénovaný, aby
          // bolo na čo ťuknúť. Staršie než okno rostera už v dátach nie sú.
          lastSession ? (
            <SessionRow session={lastSession} showDate />
          ) : (
            <p className="text-sm text-muted">{t("noSessionsToday")}</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.today.map((session) => (
              <li key={session.id}>
                <SessionRow session={session} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        {/* Graf si nadpis nesie vo vlastnej karte, takže vlastný nadpis sekcie
            by stál hneď nad ním druhýkrát. */}
        {showChart ? null : (
          <h2 className="text-sm font-medium text-muted">
            {t("tomorrowHeading")}
          </h2>
        )}
        {overview.tomorrow.length === 0 ? (
          // Keď na zajtra nič nie je, ukáže sa generálny graf vybraného hráča
          // za predvolené obdobie analytiky — ťuknutím sa otvorí celá
          // analytika, kde je čitateľný (používateľ, 2026-09-24).
          showChart ? (
            // Graf si vlastnú kartu kreslí sám, takže odkaz je len obal —
            // inak by vznikol rámček v rámčeku a bol by širší než riadky
            // rozvrhu nad ním.
            <Link
              href={analyticsHref}
              aria-label={t("openAnalytics")}
              className="block w-full min-w-0"
            >
              <CategoryShareChart
                shares={shares}
                currentCategory={null}
                heading={t("focusHeading")}
              />
            </Link>
          ) : (
            <p className="text-sm text-muted">{t("noSessionsTomorrow")}</p>
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.tomorrow.map((session) => (
              <li key={session.id}>
                <SessionRow session={session} muted />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Riadok rozvrhu: čas, meno hráča a stav — nič viac. Zameranie cvičení a dĺžka
 * pod menom boli do 2026-09-21; používateľ ich na nástenke nechce, detail
 * tréningu je na jedno ťuknutie.
 */
async function SessionRow({
  session,
  muted,
  showDate,
}: {
  session: ScheduledSession;
  muted?: boolean;
  /** Pri staršom tréningu nestačí čas — bez dátumu nie je jasné, kedy bol. */
  showDate?: boolean;
}) {
  const t = await getTranslations("Today");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();

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
          {showDate
            ? format.dateTime(new Date(session.date), {
                day: "numeric",
                month: "short",
              })
            : format.dateTime(new Date(session.date), { timeStyle: "short" })}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {session.playerName}
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
