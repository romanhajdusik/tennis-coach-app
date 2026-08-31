"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updatePlayer } from "@/lib/actions/players";

/**
 * Oprava karty hráča. Je zabalená v `<details>` zámerne — na karte už žije
 * zdieľanie aj prepojenie a oprava mena je vzácny úkon, takže rozbalený
 * formulár by na telefóne odtlačil všetko podstatné pod okraj.
 */
export function EditPlayerForm({
  playerId,
  name,
  birthYear,
}: {
  playerId: string;
  name: string;
  birthYear: number | null;
}) {
  const t = useTranslations("Players.editForm");
  const [state, formAction, pending] = useActionState(
    updatePlayer.bind(null, playerId),
    undefined,
  );
  const currentYear = new Date().getFullYear();

  return (
    <details className="border-t border-border pt-3">
      <summary className="cursor-pointer text-sm font-medium text-muted ">
        {t("heading")}
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`edit-name-${playerId}`}
            className="text-sm font-medium text-foreground "
          >
            {t("nameLabel")}
          </label>
          <input
            id={`edit-name-${playerId}`}
            name="name"
            type="text"
            required
            defaultValue={name}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`edit-birth-year-${playerId}`}
            className="text-sm font-medium text-foreground "
          >
            {t("birthYearLabel")}
          </label>
          <input
            id={`edit-birth-year-${playerId}`}
            name="birth_year"
            type="number"
            inputMode="numeric"
            min={1900}
            max={currentYear}
            step={1}
            defaultValue={birthYear ?? ""}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          />
        </div>
        <p className="text-xs text-muted ">{t("hint")}</p>
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 "
        >
          {pending ? t("submitPending") : t("submit")}
        </button>
      </form>
    </details>
  );
}
