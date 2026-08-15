"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  assignPlayer,
  type AssignFormState,
} from "@/lib/actions/player-assignment";

export type AssignableCoach = {
  userId: string;
  name: string;
  discipline: string;
};

/**
 * Preradenie hráča inému trénerovi — jediné miesto, kde šéftréner zasahuje do
 * hráčskych riadkov, a to len do priradenia (§5.4, zvyšok dohľadu ostáva
 * read-only).
 *
 * Ide o formulár so server action, takže funguje aj bez JavaScriptu; výber sa
 * odosiela tlačidlom zámerne — `onChange` submit by pri preklikávaní zoznamu
 * preradil hráča omylom.
 */
export function AssignPlayer({
  playerId,
  coaches,
  currentCoachId,
}: {
  playerId: string;
  coaches: AssignableCoach[];
  /** `null` = hráč po odídenom trénerovi (nikoho nemá vybraného). */
  currentCoachId: string | null;
}) {
  const t = useTranslations("Director.assign");
  const [state, formAction, pending] = useActionState<AssignFormState, FormData>(
    assignPlayer.bind(null, playerId),
    undefined,
  );

  if (coaches.length === 0) {
    return <p className="text-xs text-muted">{t("noCoaches")}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`assign-${playerId}`}>
          {t("label")}
        </label>
        <select
          id={`assign-${playerId}`}
          name="coachId"
          defaultValue={currentCoachId ?? ""}
          className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground"
        >
          {!currentCoachId && <option value="">{t("placeholder")}</option>}
          {/* Disciplína je pri mene zámerne: preradenie sa týka LEN jej, takže
              výberom kondičného trénera sa tenisové priradenie nezmení. Bez
              štítku by šéftréner nevedel, čo vlastne mení. */}
          {coaches.map((coach) => (
            <option key={coach.userId} value={coach.userId}>
              {`${coach.name} — ${
                coach.discipline === "fitness"
                  ? t("disciplineFitness")
                  : t("disciplineTennis")
              }`}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="flex-none rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? t("pending") : t("submit")}
        </button>
      </div>
      {state?.error && (
        <p className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
