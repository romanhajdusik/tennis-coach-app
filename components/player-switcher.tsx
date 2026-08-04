import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { selectPlayer } from "@/lib/actions/selected-player";
import {
  getActivePlayers,
  pickSelectedPlayer,
  readSelectedPlayerId,
} from "@/lib/players/selected";

/**
 * Prepínač aktívneho hráča pre federačného trénera (1:N).
 *
 * V samostatnom (1:1) režime má tréner najviac jedného aktívneho hráča, takže
 * sa nevykreslí nič — appka vyzerá presne ako doteraz.
 */
export async function PlayerSwitcher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const players = await getActivePlayers(supabase, user.id);
  if (players.length < 2) {
    return null;
  }

  const selected = pickSelectedPlayer(players, await readSelectedPlayerId());
  const t = await getTranslations("Players");

  return (
    <section className="flex w-full min-w-0 flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">{t("switcherHeading")}</h2>
      <div className="flex flex-wrap gap-2">
        {players.map((player) => {
          const isSelected = player.id === selected?.id;
          return (
            <form key={player.id} action={selectPlayer.bind(null, player.id)}>
              <button
                type="submit"
                aria-label={t("selectPlayer", { name: player.name })}
                aria-current={isSelected ? "true" : undefined}
                className={
                  isSelected
                    ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    : "rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground"
                }
              >
                {player.name}
              </button>
            </form>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t("switcherHint")}</p>
    </section>
  );
}
