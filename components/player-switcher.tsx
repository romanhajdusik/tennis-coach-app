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
 *
 * `heading` prepíše predvolený nadpis „Viewing". Na nástenke je to „Players"
 * (od 2026-09-21): tam výber hráča nahrádza tlačidlo na zoznam hráčov, kým na
 * kalendári, tréningoch a v analytike hovorí, čie dáta sa práve zobrazujú.
 *
 * `singlePlaceholder` vykreslí sekciu aj pri JEDINOM hráčovi — s jeho čipom a
 * vedľa neho sivým neaktívnym čipom s týmto textom („noname"). Chce to
 * používateľ na nástenke (2026-09-21), aby tam časť „Players" nebola prázdna;
 * inde sa pri jednom hráčovi nevykreslí nič, lebo niet medzi kým prepínať.
 */
export async function PlayerSwitcher({
  heading,
  singlePlaceholder,
}: { heading?: string; singlePlaceholder?: string } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const players = await getActivePlayers(supabase, user.id);
  const single = players.length === 1 && singlePlaceholder !== undefined;
  if (players.length < 2 && !single) {
    return null;
  }

  const selected = pickSelectedPlayer(players, await readSelectedPlayerId());
  const t = await getTranslations("Players");

  return (
    <section className="flex w-full min-w-0 flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">
        {heading ?? t("switcherHeading")}
      </h2>
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
        {single && (
          <span
            aria-hidden
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted opacity-60"
          >
            {singlePlaceholder}
          </span>
        )}
      </div>
      <p className="text-xs text-muted">{t("switcherHint")}</p>
    </section>
  );
}
