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
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t("heading")}
      </h2>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="name"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {t("nameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="birth_date"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {t("birthDateLabel")}
        </label>
        <input
          id="birth_date"
          name="birth_date"
          type="date"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? t("submitPending") : t("submit")}
      </button>
    </form>
  );
}
