"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { register } from "@/lib/actions/auth";

export function RegisterForm({ promoRequired }: { promoRequired: boolean }) {
  const t = useTranslations("Auth.register");
  const [state, formAction, pending] = useActionState(register, undefined);

  // Účet vznikol, ale prihlásiť sa dá až po kliknutí v maili. Bez tejto
  // obrazovky by to vyzeralo, že odoslanie formulára nespravilo nič.
  if (state?.checkEmail) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-sm ">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("checkEmailHeading")}
        </h1>
        <p className="mt-2 text-sm text-muted ">{t("checkEmail")}</p>
        <Link
          href="/login"
          className="mt-6 block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
        >
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm ">
      <h1 className="text-xl font-semibold text-foreground ">
        {t("heading")}
      </h1>
      {promoRequired && (
        <p className="mt-1 text-sm text-muted ">{t("inviteOnly")}</p>
      )}
      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="promo_code"
            className="text-sm font-medium text-foreground "
          >
            {promoRequired ? t("promoCodeLabel") : t("promoCodeLabelOptional")}
          </label>
          <input
            id="promo_code"
            name="promo_code"
            type="text"
            required={promoRequired}
            autoComplete="off"
            autoCapitalize="characters"
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="full_name"
            className="text-sm font-medium text-foreground "
          >
            {t("fullNameLabel")}
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="role"
            className="text-sm font-medium text-foreground "
          >
            {t("roleLabel")}
          </label>
          <select
            id="role"
            name="role"
            defaultValue="coach"
            required
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          >
            <option value="coach">{t("roleCoach")}</option>
            <option value="parent">{t("roleParent")}</option>
            <option value="manager">{t("roleManager")}</option>
            <option value="player">{t("rolePlayer")}</option>
          </select>
        </div>
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
        {/* Vyhlásenie o veku NIE JE súhlas so spracúvaním (ten nepotrebujeme,
            spracúvame zo zmluvy) — je to podmienka zmluvnej spôsobilosti: účet
            je zmluva a maloletý ju sám uzavrieť nemôže. 16 je strop, ktorý si
            členský štát smie určiť, takže jedno číslo pokrýva celú EÚ.
            Zaškrtnutie v prehliadači je len pripomienka, rozhoduje kontrola
            v `register()`. */}
        <div className="flex items-start gap-2">
          <input
            id="age_confirmed"
            name="age_confirmed"
            type="checkbox"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <label htmlFor="age_confirmed" className="text-sm text-muted ">
            {t("ageConfirmLabel")}
          </label>
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
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline "
        >
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
