import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getTimeZone } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { activatePlayer, deactivatePlayer } from "@/lib/actions/players";
import { selectPlayer } from "@/lib/actions/selected-player";
import { getOrgContext } from "@/lib/org/context";
import {
  getActivePlayers,
  pickSelectedPlayer,
  readSelectedPlayerId,
} from "@/lib/players/selected";
import { getRosterOverview, type RosterEntry } from "@/lib/players/roster";
import { getPlayerLimitState } from "@/lib/subscription";
import {
  AttentionDot,
  ATTENTION_TEXT_CLASSES,
  SummaryTile,
  lastPracticeLabel,
  nextPracticeLabel,
} from "@/components/roster-status";
import { AddPlayerForm } from "./add-player-form";
import { SharePlayerSection } from "./share-player-section";

export default async function PlayersPage() {
  const t = await getTranslations("Players");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Federačný tréner má viacerých aktívnych hráčov naraz (1:N), samostatný
  // najviac jedného — tá istá obrazovka teda raz vyzerá ako roster, raz ako
  // dnešná karta jediného hráča.
  const org = await getOrgContext();
  const activePlayers = await getActivePlayers(supabase, user.id);
  const selectedPlayer = pickSelectedPlayer(
    activePlayers,
    await readSelectedPlayerId(),
  );

  const { data: allPlayers } = await supabase
    .from("players")
    .select("id, name, birth_year, is_active")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: true });

  const archivedPlayers = (allPlayers ?? []).filter(
    (player) => !player.is_active,
  );

  // Zdieľanie s rodičom/hráčom je funkcia samostatného produktu — vo federácii
  // sú tréningové dáta interné a rodičovský prístup neexistuje (§5.6).
  //
  // Načítavajú sa prepojenia VŠETKÝCH hráčov naraz, nie len vybraného: panel
  // zdieľania žije v karte každého hráča, takže dotaz na hráča by znamenal
  // toľko dotazov, koľko má tréner detí.
  const { data: connections } = !org
    ? await supabase
        .from("player_connections")
        .select("id, player_id, connect_code, status, connected_role")
        .eq("coach_id", user.id)
        .in("status", ["pending", "active"])
    : { data: null };

  const connectionByPlayer = new Map(
    (connections ?? []).map((connection) => [connection.player_id, connection]),
  );

  // Koľko hráčov smie mať účet naraz aktívnych, je cenová hladina. Rozhoduje
  // o nej `lib/subscription.ts` (aj o rozdiele „vyčerpaná" vs „prekročená");
  // tu sa číta len preto, aby sa nevykreslilo tlačidlo, ktoré by server aj tak
  // odmietol. `null` = federačný tréner, toho sa hladina netýka.
  const limitState = await getPlayerLimitState(supabase, user.id);

  // Roster = federačný tréner s viacerými pridelenými hráčmi (1:N). Až tam
  // dávajú stavy „X dní bez tréningu" zmysel, preto sa dopočítavajú len preň.
  const isRoster = activePlayers.length > 1;
  const overview = isRoster
    ? await getRosterOverview(supabase, activePlayers, await getTimeZone())
    : null;
  // Texty stavov sa skladajú vopred — `map()` v JSX nevie čakať na preklady.
  const rosterLabels = new Map<
    string,
    { entry: RosterEntry; last: string; next: string }
  >();
  for (const entry of overview?.entries ?? []) {
    rosterLabels.set(entry.player.id, {
      entry,
      last: await lastPracticeLabel(entry),
      next: await nextPracticeLabel(entry.nextSession),
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">{t("title")}</h1>
        <Link href="/" className="text-sm font-medium text-muted underline ">
          {tCommon("back")}
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted ">
          {isRoster ? t("rosterHeading") : t("activePlayerHeading")}
        </h2>

        {overview && (
          <div className="grid grid-cols-3 gap-2">
            <SummaryTile
              value={activePlayers.length}
              label={t("roster.summaryPlayers")}
            />
            <SummaryTile
              value={overview.today.length}
              label={t("roster.summaryToday")}
            />
            <SummaryTile
              value={overview.attentionCount}
              label={t("roster.summaryAttention")}
              highlight={overview.attentionCount > 0}
            />
          </div>
        )}

        {activePlayers.length === 0 ? (
          <p className="text-sm text-muted ">{t("noActivePlayer")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activePlayers.map((player) => {
              const isSelected = player.id === selectedPlayer?.id;
              const status = rosterLabels.get(player.id);
              return (
                <li
                  key={player.id}
                  className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${
                    isSelected && isRoster ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        {status && (
                          <AttentionDot level={status.entry.attention} />
                        )}
                        <span className="truncate">{player.name}</span>
                        {status && player.birth_year && (
                          <span className="flex-none text-xs font-normal text-muted">
                            {player.birth_year}
                          </span>
                        )}
                      </p>
                      {!status && player.birth_year && (
                        <p className="text-sm text-muted ">
                          {player.birth_year}
                        </p>
                      )}
                      {status && (
                        <>
                          <p
                            className={`text-xs ${ATTENTION_TEXT_CLASSES[status.entry.attention]}`}
                          >
                            {status.last}
                          </p>
                          <p className="text-xs text-muted">{status.next}</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      {isRoster &&
                        (isSelected ? (
                          <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                            {t("switcherHeading")}
                          </span>
                        ) : (
                          <form action={selectPlayer.bind(null, player.id)}>
                            <button
                              type="submit"
                              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium "
                            >
                              {t("activate")}
                            </button>
                          </form>
                        ))}
                      <form action={deactivatePlayer.bind(null, player.id)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium "
                        >
                          {t("archive")}
                        </button>
                      </form>
                    </div>
                  </div>

                  {!org && (
                    <SharePlayerSection
                      playerId={player.id}
                      connection={connectionByPlayer.get(player.id) ?? null}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {isRoster && (
          <p className="text-xs text-muted ">{t("switcherHint")}</p>
        )}

        {/* Cenová hladina sa ukazuje aj keď je ešte voľná — tréner tak vie, na
            čom je, skôr než mu zakladanie hráča odmietne server. Federačného
            trénera sa netýka (platí organizácia), a to sa pýtame členstva, nie
            hostname: RLS mu jeho org hráčov vydá aj mimo org subdomény. */}
        {limitState && (
          <p className="text-xs text-muted">
            {t("limit.counter", {
              count: limitState.active,
              limit: limitState.limit,
            })}
            {limitState.exceeded
              ? ` — ${t("limit.exceeded", {
                  excess: limitState.active - limitState.limit,
                })}`
              : limitState.reached && ` — ${t("limit.reached")}`}
          </p>
        )}
      </section>

      <AddPlayerForm />

      {archivedPlayers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted ">
            {t("archiveHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {archivedPlayers.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 "
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground ">
                    {player.name}
                  </p>
                  {player.birth_year && (
                    <p className="text-sm text-muted ">{player.birth_year}</p>
                  )}
                </div>
                {/* Pri vyčerpanej hladine sa tlačidlo nevykreslí — server by
                    vrátenie z archívu aj tak odmietol (`requirePlayerSlot`)
                    a mlčky, takže by klik vyzeral ako pokazená appka. */}
                {!limitState?.reached && (
                  <form action={activatePlayer.bind(null, player.id)}>
                    <button
                      type="submit"
                      className="flex-none rounded-lg border border-border px-3 py-1.5 text-sm font-medium "
                    >
                      {t("activate")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
