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
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 "
    >
      <h2 className="text-sm font-medium text-muted ">
        {t("heading")}
      </h2>
      <p className="text-sm text-muted ">
        {t("description")}
      </p>
      <input
        name="code"
        required
        placeholder={t("codePlaceholder")}
        maxLength={8}
        className="rounded-lg border border-border px-3 py-2 text-center font-mono text-lg uppercase tracking-widest bg-input"
      />
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
