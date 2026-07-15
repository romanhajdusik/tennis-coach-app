"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { claimConnection } from "@/lib/actions/player-connections";

export function ConnectForm() {
  const t = useTranslations("Parent.connect");
  const [state, formAction, pending] = useActionState(claimConnection, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t("heading")}
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("description")}
      </p>
      <input
        name="code"
        required
        placeholder={t("codePlaceholder")}
        maxLength={8}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-lg uppercase tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
      />
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
