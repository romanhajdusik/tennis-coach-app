"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { copySessionToPlayer } from "@/lib/actions/sessions";

/**
 * Zapísanie toho istého tréningu ďalšiemu hráčovi (skupinový tréning).
 *
 * Vykresľuje sa len vtedy, keď má tréner koho ponúknuť — pri jedinom
 * aktívnom hráčovi je tlačidlo bez zmyslu. Ponúka sa aj pri dokončenom
 * tréningu: práve vtedy tréner najčastejšie zisťuje, že na kurte bolo detí
 * viac, než koľko ich zapísal.
 */
export function CopyToPlayerForm({
  sessionId,
  players,
}: {
  sessionId: string;
  players: { id: string; name: string }[];
}) {
  const t = useTranslations("Sessions.copy");
  const [state, formAction, pending] = useActionState(
    copySessionToPlayer.bind(null, sessionId),
    undefined,
  );
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-medium text-muted">{t("heading")}</h2>
      <p className="text-xs text-muted">{t("hint")}</p>

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
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

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
