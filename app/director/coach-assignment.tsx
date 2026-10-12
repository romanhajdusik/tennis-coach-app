"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addPlayerCoaches,
  removePlayerCoaches,
  type CoachAssignmentState,
} from "@/lib/actions/player-assignment";

export type AssignableCoach = {
  userId: string;
  name: string;
  /** Popis disciplíny („Tennis", „Fitness") — zložený na serveri. */
  disciplineLabel: string;
};

/**
 * Priradenie a odobratie trénerov hráčom — jediné miesto, kde šéftréner
 * zasahuje do hráčskych riadkov, a to len do priradenia (§5.4, zvyšok dohľadu
 * ostáva read-only).
 *
 * Od 2026-10-12 môže mať hráč v disciplíne viac trénerov naraz, takže namiesto
 * „preraď" sú tu „pridaj" a „odober". Formuláre idú cez server action a
 * fungujú aj bez JavaScriptu; výber sa odosiela tlačidlom zámerne — `onChange`
 * submit by pri preklikávaní zoznamu pridal trénera omylom.
 */

function Feedback({ state }: { state: CoachAssignmentState }) {
  if (state?.error) {
    return (
      <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p className="rounded-lg bg-emerald-950 px-3 py-2 text-xs text-emerald-300">
        {state.message}
      </p>
    );
  }
  return null;
}

/** Pridanie jedného trénera jednému hráčovi (profil hráča, hráči bez trénera). */
export function AddCoachForm({
  playerId,
  coaches,
}: {
  playerId: string;
  /** Len tréneri, ktorí hráča ešte nemajú. */
  coaches: AssignableCoach[];
}) {
  const t = useTranslations("Director.assign");
  const [state, formAction, pending] = useActionState<
    CoachAssignmentState,
    FormData
  >(addPlayerCoaches, undefined);

  if (coaches.length === 0) {
    return <p className="text-xs text-muted">{t("allAssigned")}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="playerId" value={playerId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`add-coach-${playerId}`}>
          {t("label")}
        </label>
        <select
          id={`add-coach-${playerId}`}
          name="coachId"
          defaultValue=""
          className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">{t("placeholder")}</option>
          {/* Disciplína je pri mene zámerne: priradenie platí pre disciplínu
              trénera, takže šéftréner musí vidieť, ktorú pridáva. */}
          {coaches.map((coach) => (
            <option key={coach.userId} value={coach.userId}>
              {`${coach.name} — ${coach.disciplineLabel}`}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="flex-none rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? t("adding") : t("add")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/**
 * Odobratie trénera od hráča — dvojkrokovo, lebo zruší jeho naplánované
 * tréningy s týmto hráčom.
 */
export function RemoveCoachButton({
  playerId,
  coachId,
  coachName,
}: {
  playerId: string;
  coachId: string;
  coachName: string;
}) {
  const t = useTranslations("Director.assign");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<
    CoachAssignmentState,
    FormData
  >(removePlayerCoaches, undefined);

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex-none rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground"
        >
          {t("remove")}
        </button>
        <Feedback state={state} />
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-2 rounded-lg border border-red-900 bg-red-950/40 p-3"
    >
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="coachId" value={coachId} />
      <input type="hidden" name="confirm" value="yes" />
      <p className="text-xs text-foreground">
        {t("removeConfirm", { name: coachName })}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {pending ? t("removing") : t("confirmRemove")}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground"
        >
          {t("keep")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export type BulkPlayer = {
  id: string;
  name: string;
  birthYear: number | null;
  /** Mená súčasných trénerov, už zložené („Peter, Marek"). */
  coachNames: string;
};

/**
 * Hromadné priradenie: zaškrtnúť hráčov a trénerov, jedným krokom priradiť
 * alebo odobrať (rozhodol user 2026-10-12 — zväzy majú bežne skupinu 2–3
 * trénerov na 6–10 hráčov; pomenované skupiny zámerne nie).
 */
export function BulkAssignForm({
  players,
  coaches,
}: {
  players: BulkPlayer[];
  coaches: AssignableCoach[];
}) {
  const t = useTranslations("Director.bulk");
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    () => new Set(),
  );
  const [addState, addAction, adding] = useActionState<
    CoachAssignmentState,
    FormData
  >(addPlayerCoaches, undefined);
  const [removeState, removeAction, removing] = useActionState<
    CoachAssignmentState,
    FormData
  >(removePlayerCoaches, undefined);

  const allSelected =
    players.length > 0 && selectedPlayers.size === players.length;

  function togglePlayer(id: string) {
    setSelectedPlayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <fieldset className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <legend className="px-1 text-sm font-medium text-foreground">
            {t("playersHeading")}
          </legend>
          {players.length === 0 ? (
            <p className="text-sm text-muted">{t("noPlayers")}</p>
          ) : (
            <>
              <label className="flex items-center gap-2 border-b border-border pb-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelectedPlayers(
                      allSelected
                        ? new Set()
                        : new Set(players.map((player) => player.id)),
                    )
                  }
                />
                {t("selectAll")}
              </label>
              <ul className="flex flex-col gap-1">
                {players.map((player) => (
                  <li key={player.id}>
                    <label className="flex items-start gap-2 rounded-lg px-1 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="playerId"
                        value={player.id}
                        checked={selectedPlayers.has(player.id)}
                        onChange={() => togglePlayer(player.id)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block text-foreground">
                          {player.name}
                          {player.birthYear && (
                            <span className="text-xs text-muted">
                              {` · ${player.birthYear}`}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {player.coachNames || t("noCoachYet")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <legend className="px-1 text-sm font-medium text-foreground">
            {t("coachesHeading")}
          </legend>
          {coaches.length === 0 ? (
            <p className="text-sm text-muted">{t("noCoaches")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {coaches.map((coach) => (
                <li key={coach.userId}>
                  <label className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
                    <input type="checkbox" name="coachId" value={coach.userId} />
                    <span className="min-w-0 truncate text-foreground">
                      {coach.name}
                      <span className="text-xs text-muted">
                        {` · ${coach.disciplineLabel}`}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <button
          type="submit"
          formAction={addAction}
          disabled={adding || removing}
          className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {adding ? t("assigning") : t("assign")}
        </button>
        <Feedback state={addState} />

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" name="confirm" value="yes" className="mt-0.5" />
            {t("removeConfirm")}
          </label>
          <button
            type="submit"
            formAction={removeAction}
            disabled={adding || removing}
            className="self-start rounded-lg border border-red-900 bg-red-950 px-4 py-2 text-sm font-medium text-red-300 disabled:opacity-60"
          >
            {removing ? t("removing") : t("remove")}
          </button>
          <Feedback state={removeState} />
        </div>
      </div>
    </form>
  );
}
