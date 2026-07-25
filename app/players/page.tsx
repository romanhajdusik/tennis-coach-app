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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted ">
          {t("activePlayerHeading")}
        </h2>
        {activePlayer ? (
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 ">
            <div>
              <p className="font-medium text-foreground ">
                {activePlayer.name}
              </p>
              {activePlayer.birth_date && (
                <p className="text-sm text-muted ">
                  {activePlayer.birth_date}
                </p>
              )}
            </div>
            <form action={deactivatePlayer.bind(null, activePlayer.id)}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium "
              >
                {t("archive")}
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-muted ">
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
          <h2 className="text-sm font-medium text-muted ">
            {t("archiveHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {archivedPlayers.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 "
              >
                <div>
                  <p className="font-medium text-foreground ">
                    {player.name}
                  </p>
                  {player.birth_date && (
                    <p className="text-sm text-muted ">
                      {player.birth_date}
                    </p>
                  )}
                </div>
                <form action={activatePlayer.bind(null, player.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium "
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
