"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { copySessionToPlayer } from "@/lib/actions/sessions";

export type CopyTarget = {
  id: string;
  name: string;
  /** Meno trénera — vyplnené len pri hráčoch iných trénerov organizácie. */
  coachName: string | null;
};

/**
 * Zapísanie toho istého tréningu ďalšiemu hráčovi (skupinový tréning).
 *
 * Vykresľuje sa len vtedy, keď má tréner koho ponúknuť. Ponúka sa aj pri
 * dokončenom tréningu: práve vtedy tréner najčastejšie zisťuje, že na kurte
 * bolo detí viac, než koľko ich zapísal.
 *
 * Vo federácii sú v ponuke aj hráči iných trénerov, oddelene a s menom
 * trénera — tréning sa potom objaví u nich, nie u zapisujúceho, takže výber
 * nesmie vyzerať ako výber „svojho" hráča.
 */
export function CopyToPlayerForm({
  sessionId,
  players,
}: {
  sessionId: string;
  players: CopyTarget[];
}) {
  const t = useTranslations("Sessions.copy");
  const [state, formAction, pending] = useActionState(
    copySessionToPlayer.bind(null, sessionId),
    undefined,
  );
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");

  const mine = players.filter((player) => !player.coachName);
  const others = players.filter((player) => player.coachName);
  const copiedTo = state?.copiedTo
    ? players.find((player) => player.id === state.copiedTo)
    : null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-medium text-muted">{t("heading")}</h2>
      <p className="text-xs text-muted">
        {others.length > 0 ? t("hintOrg") : t("hint")}
      </p>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="copy_player"
          className="text-sm font-medium text-foreground"
        >
          {t("playerLabel")}
        </label>
        <select
          id="copy_player"
          name="player_id"
          value={playerId}
          onChange={(event) => setPlayerId(event.target.value)}
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
        >
          {others.length === 0 ? (
            players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))
          ) : (
            <>
              {mine.length > 0 && (
                <optgroup label={t("groupMine")}>
                  {mine.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t("groupOthers")}>
                {others.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} — {player.coachName}
                  </option>
                ))}
              </optgroup>
            </>
          )}
        </select>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      {/* Pri hráčovi iného trénera sa appka nemá kam presmerovať — jeho
          tréning tomuto trénerovi RLS nevydá — takže potvrdenie musí prísť
          sem, inak by klik vyzeral, že sa nič nestalo. */}
      {copiedTo && (
        <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          {t("copiedToOtherCoach", {
            name: copiedTo.name,
            coach: copiedTo.coachName ?? "",
          })}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {pending ? t("submitPending") : t("submit")}
      </button>
    </form>
  );
}
