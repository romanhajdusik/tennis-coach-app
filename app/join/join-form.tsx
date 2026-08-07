"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  claimOrganizationInvite,
  type InviteFormState,
} from "@/lib/actions/organization-members";

export function JoinForm() {
  const t = useTranslations("Join");
  const [state, formAction, isPending] = useActionState<
    InviteFormState,
    FormData
  >(claimOrganizationInvite, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm font-medium text-foreground">
        {t("codeLabel")}
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="off"
        autoCapitalize="characters"
        placeholder={t("codePlaceholder")}
        className="rounded-lg border border-border bg-input px-3 py-2 text-lg tracking-widest text-foreground uppercase"
      />

      {state?.error && (
        <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {isPending ? t("submitPending") : t("submit")}
      </button>
    </form>
  );
}
