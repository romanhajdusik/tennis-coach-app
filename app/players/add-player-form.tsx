"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createPlayer } from "@/lib/actions/players";

export function AddPlayerForm() {
  const t = useTranslations("Players.addForm");
  const [state, formAction, pending] = useActionState(createPlayer, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 "
    >
      <h2 className="text-sm font-medium text-muted ">
        {t("heading")}
      </h2>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="name"
          className="text-sm font-medium text-foreground "
        >
          {t("nameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="birth_date"
          className="text-sm font-medium text-foreground "
        >
          {t("birthDateLabel")}
        </label>
        <input
          id="birth_date"
          name="birth_date"
          type="date"
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
      >
        {pending ? t("submitPending") : t("submit")}
      </button>
    </form>
  );
}
