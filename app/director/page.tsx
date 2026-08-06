import Link from "next/link";
import { getTranslations, getTimeZone } from "next-intl/server";
import { logout } from "@/lib/actions/auth";
import { getDirectorDashboard, type DirectorPlayer } from "@/lib/org/director";
import { requireDirector } from "./guard";
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

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{org.name}</h1>
        <p className="text-sm text-muted">
          {t("title")} ·{" "}
          {t("subtitle", {
            coaches: dashboard.coachCount,
            players: dashboard.players.length,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
              open={coach.attentionCount > 0}
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
                <ul className="mt-3 flex flex-col gap-2">
                  {coach.players.map((entry) => (
                    <li key={entry.player.id}>
                      <PlayerCard
                        entry={entry}
                        last={labels.get(entry.player.id)?.last ?? ""}
                        next={labels.get(entry.player.id)?.next ?? ""}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </details>
          ))
        )}
      </section>

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
