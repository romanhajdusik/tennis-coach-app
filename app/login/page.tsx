"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const t = useTranslations("Auth.login");
  const loginAction = login.bind(null, "/");
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 ">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm ">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("heading")}
        </h1>
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
              autoComplete="current-password"
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
        <p className="mt-4 text-center text-sm text-muted ">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline "
          >
            {t("registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
