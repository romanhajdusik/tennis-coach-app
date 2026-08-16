"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/request-origin";

export type ResetRequestState = { error?: string; sent?: boolean } | undefined;
export type NewPasswordState = { error?: string } | undefined;

/** Kam sa človek vráti po kliknutí na odkaz v maili. */
const CONFIRM_PATH = "/auth/confirm";
const NEW_PASSWORD_PATH = "/reset-password";

/**
 * Žiadosť o obnovu hesla — pošle na zadanú adresu mail s odkazom.
 *
 * **Odpoveď je zámerne vždy rovnaká**, aj keď taký účet neexistuje alebo
 * odoslanie zlyhalo. Rozlišovanie by z tejto stránky spravilo overovač adries:
 * ktokoľvek by si vedel vyskúšať, či daný človek appku používa. Skutočné
 * zlyhanie preto ide len do serverového logu.
 */
export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = ((formData.get("email") as string) ?? "").trim();
  const t = await getTranslations("Auth.errors");

  if (!email) {
    return { error: t("missingEmail") };
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const redirectTo = `${origin}${CONFIRM_PATH}?next=${encodeURIComponent(
    NEW_PASSWORD_PATH,
  )}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Typicky limit odoslaných mailov alebo výpadok mailera — používateľ sa to
    // podľa pravidla vyššie nedozvie, ale my to musíme vidieť.
    console.error("Obnova hesla — mail sa neodoslal:", error.message);
  }

  return { sent: true };
}

/**
 * Nastavenie nového hesla. Beží až po tom, čo odkaz z mailu vytvoril session
 * (`/auth/confirm`), takže sa tu už len overuje, že session naozaj existuje —
 * bez nej by `updateUser` menil heslo nikomu.
 */
export async function updatePassword(
  _prevState: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("password_confirm") as string;
  const t = await getTranslations("Auth.errors");

  if (!password || !passwordConfirm) {
    return { error: t("missingPasswordFields") };
  }

  // Rovnaké pravidlá ako pri registrácii — inak by sa cez obnovu hesla dalo
  // obísť to, čo register() vyžaduje.
  if (password.length < 8) {
    return { error: t("passwordTooShort") };
  }

  if (password !== passwordConfirm) {
    return { error: t("passwordsDoNotMatch") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t("resetSessionMissing") };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // Hlášky Supabase sú po anglicky ako celá appka (napr. že nové heslo sa
    // musí líšiť od starého), takže sú pre používateľa čitateľné — rovnako to
    // robí aj register().
    return { error: error.message };
  }

  // Odkaz z mailu človeka prihlásil, takže ho už netreba posielať na
  // prihlásenie. `/` si samo rozdelí trénera a rodiča/hráča podľa roly.
  redirect("/");
}
