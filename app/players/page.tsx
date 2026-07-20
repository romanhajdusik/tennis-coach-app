import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { activatePlayer, deactivatePlayer } from "@/lib/actions/players";
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

  const { data: players } = await supabase
    .from("players")
    .select("id, name, birth_date, is_active")
    .eq("coach_id", user.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  const activePlayer = players?.find((player) => player.is_active);
  const archivedPlayers = players?.filter((player) => !player.is_active) ?? [];

  const { data: connection } = activePlayer
    ? await supabase
        .from("player_connections")
        .select("id, connect_code, status, connected_role")
        .eq("coach_id", user.id)
        .eq("player_id", activePlayer.id)
        .in("status", ["pending", "active"])
        .maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          {tCommon("back")}
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {t("activePlayerHeading")}
        </h2>
        {activePlayer ? (
          <div className="flex items-center justify-between rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {activePlayer.name}
              </p>
              {activePlayer.birth_date && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {activePlayer.birth_date}
                </p>
              )}
            </div>
            <form action={deactivatePlayer.bind(null, activePlayer.id)}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
              >
                {t("archive")}
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("noActivePlayer")}
          </p>
        )}
      </section>

      {activePlayer && (
        <SharePlayerSection playerId={activePlayer.id} connection={connection} />
      )}

      <AddPlayerForm />

      {archivedPlayers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t("archiveHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {archivedPlayers.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {player.name}
                  </p>
                  {player.birth_date && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {player.birth_date}
                    </p>
                  )}
                </div>
                <form action={activatePlayer.bind(null, player.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
                  >
                    {t("activate")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
