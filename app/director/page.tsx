import Link from "next/link";
import { getTranslations, getTimeZone } from "next-intl/server";
import { logout } from "@/lib/actions/auth";
import { getDirectorDashboard, type DirectorPlayer } from "@/lib/org/director";
import { requireDirector } from "./guard";
import { AssignPlayer } from "./assign-player";
import {
  AttentionDot,
  ATTENTION_TEXT_CLASSES,
  SummaryTile,
  lastPracticeLabel,
  nextPracticeLabel,
} from "@/components/roster-status";

/**
 * Riadiaci pult šéftrénera federácie — **read-only** prehľad celej
 * organizácie (§5.7: director má SELECT-only nad org riadkami).
 *
 * Zámerne nie je „druhá trénerova appka": šéftréner tu nič neplánuje ani
 * nezapisuje, len vidí, ako spolupráca beží — kto trénuje, kto vypadol
 * z rytmu a čo sa reálne odohralo.
 */
export default async function DirectorPage() {
  const t = await getTranslations("Director");
  const tCompare = await getTranslations("Director.compare");
  const tTeam = await getTranslations("Director.team");
  const tDrillCodes = await getTranslations("Director.drillCodes");
  const { supabase, org } = await requireDirector();
  const timeZone = await getTimeZone();

  const dashboard = await getDirectorDashboard(supabase, org.id, timeZone);

  // Texty stavov sa skladajú vopred — `map()` v JSX nevie čakať na preklady.
  const labels = new Map<string, { last: string; next: string }>();
  for (const entry of dashboard.players) {
    labels.set(entry.player.id, {
      last: await lastPracticeLabel(entry),
      next: await nextPracticeLabel(entry.nextSession),
    });
  }

  const attentionCount = dashboard.attention.length;

  // Komu sa dá hráč prideliť — len aktívni tréneri (skupina po odídenom
  // trénerovi `userId` nemá).
  const assignable = dashboard.coaches
    .filter((coach) => coach.userId)
    .map((coach) => ({ userId: coach.userId as string, name: coach.name }));

  return (
    // Pult je nástroj pre laptop/tablet (na rozdiel od trénerovej appky, ktorá
    // sa používa na kurte) — na širokej ploche stoja zoznamy vedľa seba, na
    // mobile sa poskladajú pod seba.
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{org.name}</h1>
          <p className="text-sm text-muted">
            {t("title")} ·{" "}
            {t("subtitle", {
              coaches: dashboard.coachCount,
              players: dashboard.players.length,
            })}
          </p>
        </div>
        {/* Bez `flex-none`: na mobile sa tri tlačidlá musia zalomiť, inak
            hlavička pretečie cez viewport. */}
        <nav className="flex min-w-0 flex-wrap gap-2">
          <Link
            href="/director/compare"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {tCompare("link")}
          </Link>
          <Link
            href="/director/team"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground"
          >
            {tTeam("link")}
          </Link>
          <Link
            href="/director/drill-codes"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground"
          >
            {tDrillCodes("link")}
          </Link>
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryTile
          value={dashboard.players.length}
          label={t("summary.players")}
        />
        <SummaryTile value={dashboard.coachCount} label={t("summary.coaches")} />
        <SummaryTile
          value={dashboard.sessionsToday}
          label={t("summary.sessionsToday")}
        />
        <SummaryTile
          value={attentionCount}
          label={t("summary.attention")}
          highlight={attentionCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {t("attentionHeading")}
        </h2>
        {attentionCount === 0 ? (
          <p className="text-sm text-muted">{t("attentionEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dashboard.attention.map((entry) => (
              <li key={entry.player.id}>
                <PlayerCard
                  entry={entry}
                  last={labels.get(entry.player.id)?.last ?? ""}
                  next={labels.get(entry.player.id)?.next ?? ""}
                  coachName={
                    dashboard.coaches.find(
                      (coach) => coach.userId === entry.coachId,
                    )?.name ?? t("formerCoach")
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">
          {t("coachesHeading")}
        </h2>

        {dashboard.coaches.length === 0 ? (
          <p className="text-sm text-muted">{t("noCoaches")}</p>
        ) : (
          dashboard.coaches.map((coach) => (
            <details
              key={coach.userId ?? "former"}
              // Skupina po odídenom trénerovi je vždy rozbalená: s tými hráčmi
              // nikto nepracuje, kým ich niekto neprevezme — zbalená by sa
              // stratila medzi trénermi (a s ňou aj výber nového trénera).
              open={coach.attentionCount > 0 || !coach.userId}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <summary className="cursor-pointer list-none">
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">
                      {coach.userId ? coach.name : t("formerCoach")}
                    </span>
                    <span className="block text-xs text-muted">
                      {t("coachSummary", { players: coach.players.length })}
                      {" · "}
                      {coach.attentionCount > 0
                        ? t("attentionTag", { count: coach.attentionCount })
                        : t("allActive")}
                    </span>
                  </span>
                  <span
                    className={`h-2.5 w-2.5 flex-none rounded-full ${
                      coach.attentionCount > 0 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                </span>
              </summary>

              {!coach.userId && (
                <p className="mt-3 text-xs text-muted">
                  {t("formerCoachNote")}
                </p>
              )}

              {coach.players.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{t("noPlayers")}</p>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {coach.players.map((entry) => (
                    <li key={entry.player.id} className="flex flex-col gap-2">
                      <PlayerCard
                        entry={entry}
                        last={labels.get(entry.player.id)?.last ?? ""}
                        next={labels.get(entry.player.id)?.next ?? ""}
                      />
                      {/* Prideliť sa dá ktokoľvek (cez profil hráča), ale tu
                          na to treba siahnuť hneď — bez trénera s hráčom
                          nikto nepracuje. Formulár je mimo karty: karta je
                          `<a>` a formulár sa doň vnoriť nesmie. */}
                      {!coach.userId && (
                        <AssignPlayer
                          playerId={entry.player.id}
                          coaches={assignable}
                          currentCoachId={null}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ))
        )}
      </section>
      </div>

      <p className="text-xs text-muted">{t("readOnlyNote")}</p>

      <form action={logout.bind(null, "/login")}>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
        >
          {t("logout")}
        </button>
      </form>
    </div>
  );
}

function PlayerCard({
  entry,
  last,
  next,
  coachName,
}: {
  entry: DirectorPlayer;
  last: string;
  next: string;
  coachName?: string;
}) {
  return (
    <Link
      href={`/director/players/${entry.player.id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
          <AttentionDot level={entry.attention} />
          <span className="truncate">{entry.player.name}</span>
          {entry.player.birth_year && (
            <span className="flex-none text-xs font-normal text-muted">
              {entry.player.birth_year}
            </span>
          )}
        </span>
        {coachName && (
          <span className="block truncate text-xs text-muted">{coachName}</span>
        )}
        <span
          className={`block text-xs ${ATTENTION_TEXT_CLASSES[entry.attention]}`}
        >
          {last}
        </span>
        <span className="block text-xs text-muted">{next}</span>
      </span>
      <span aria-hidden className="flex-none text-muted">
        ›
      </span>
    </Link>
  );
}
