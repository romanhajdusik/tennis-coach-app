"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset } from "@/lib/actions/password-reset";

/**
 * Žiadosť o obnovu hesla. Jedna stránka pre trénera aj pre rodiča/hráča —
 * po prihlásení ich `/` rozdelí podľa roly, takže nemá zmysel mať dve.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("Auth.forgotPassword");
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 ">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm ">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("heading")}
        </h1>

        {state?.sent ? (
          <p className="mt-4 text-sm text-muted ">{t("sent")}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted ">{t("intro")}</p>
            <form action={formAction} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground "
                >
                  {t("emailLabel")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
                />
              </div>
              {state?.error && (
                <p className="text-sm text-red-400">{state.error}</p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
              >
                {pending ? t("submitPending") : t("submit")}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-center text-sm text-muted ">
          <Link href="/login" className="font-medium text-foreground underline ">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
