"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updatePassword } from "@/lib/actions/password-reset";

export function ResetPasswordForm() {
  const t = useTranslations("Auth.resetPassword");
  const [state, formAction, pending] = useActionState(updatePassword, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground "
        >
          {t("passwordLabel")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password_confirm"
          className="text-sm font-medium text-foreground "
        >
          {t("passwordConfirmLabel")}
        </label>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
      >
        {pending ? t("submitPending") : t("submit")}
      </button>
    </form>
  );
}
