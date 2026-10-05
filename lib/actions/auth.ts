"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/request-origin";
import {
  getDeploymentDiscipline,
  isCourtDiscipline,
} from "@/lib/disciplines/registry";

/**
 * `redirectTo` = prihlásenie prešlo a formulár má otvoriť túto cestu ÚPLNÝM
 * načítaním stránky (viď `login`).
 */
export type AuthFormState =
  | { error?: string; redirectTo?: string }
  | undefined;

/**
 * Registrácia má o stav navyše: pri zapnutom potvrdzovaní mailu účet vznikne,
 * ale session nie — človeka treba poslať do schránky, nie do appky.
 */
export type RegisterFormState =
  | { error?: string; checkEmail?: boolean }
  | undefined;

export async function login(
  redirectTo: string,
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const t = await getTranslations("Auth.errors");

  if (!email || !password) {
    return { error: t("missingLoginFields") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: t("invalidCredentials") };
  }

  // Zámerne NIE `redirect()`. Presmerovanie zo server action Next vykreslí
  // priamo v odpovedi na POST (internou požiadavkou na cieľ), takže prehliadač
  // na cieľ nikdy nepošle vlastný GET — a stráž členstva v `proxy.ts` beží len
  // pri GET. Lokálne ide tá interná požiadavka navyše na `localhost:3000`
  // (`__NEXT_PRIVATE_ORIGIN`), proxy v nej org subdoménu nespozná a tréner bez
  // členstva skončil na osobnej domovskej stránke namiesto `/join`.
  // Prihlásenie je hranica, za ktorou sa mení všetko, čo appka vykreslí, takže
  // úplné načítanie cieľa (formulár volá `window.location.assign`) nič nestojí
  // a stráž aj org kontext rozhodnú rovnako v každom prostredí.
  //
  // Cieľ je väzbový argument z klienta, preto len cesta v rámci appky —
  // rovnaké pravidlo ako `safeNext` v `app/auth/confirm/route.ts`.
  const safeTarget =
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//") &&
    !redirectTo.includes("\\")
      ? redirectTo
      : "/";

  return { redirectTo: safeTarget };
}

export async function register(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("password_confirm") as string;
  const role = formData.get("role") as string;
  const promoCode = ((formData.get("promo_code") as string) ?? "").trim();
  const t = await getTranslations("Auth.errors");

  // Registrácia je otvorená buď pre všetkých (`REGISTRATION_ENABLED`), alebo
  // len na pozvánku — vtedy je vstupenkou promo kód. Kód navyše určuje, ako
  // dlho má tréner appku zadarmo; uplatní ho databáza sama (viď migráciu
  // `20260816090000`), appka do `profiles` nezapisuje.
  const registrationOpen = process.env.REGISTRATION_ENABLED === "true";

  if (!registrationOpen && !promoCode) {
    return { error: t("promoCodeRequired") };
  }

  if (!fullName || !email || !password || !role) {
    return { error: t("missingRegisterFields") };
  }

  if (!["coach", "parent", "manager", "player", "self"].includes(role)) {
    return { error: t("invalidRole") };
  }

  // Hráčsky denník (docs §6) je trénerský účet s jedinou kartou, ktorou je
  // hráč sám — v databáze `role = 'coach'` + `self_diary`. Len na kurte;
  // kondičné nasadenie ho neponúka a databáza by ho aj tak odmietla.
  const selfDiary = role === "self";
  if (selfDiary && !isCourtDiscipline(getDeploymentDiscipline())) {
    return { error: t("invalidRole") };
  }
  const accountRole = selfDiary ? "coach" : role;

  // Vek sa overuje na serveri, nie len atribútom `required` vo formulári —
  // ten sa dá obísť a registrácia je verejná cesta. Nie je to súhlas so
  // spracúvaním (ten nepotrebujeme), ale podmienka zmluvnej spôsobilosti.
  if (formData.get("age_confirmed") !== "on") {
    return { error: t("ageNotConfirmed") };
  }

  if (password.length < 8) {
    return { error: t("passwordTooShort") };
  }

  if (password !== passwordConfirm) {
    return { error: t("passwordsDoNotMatch") };
  }

  const supabase = await createClient();

  // Kód overíme EŠTE PRED založením účtu, nech po nepodarenej registrácii
  // neostane visieť účet, ktorý sa nedá použiť. Funkcia vracia len áno/nie,
  // takže sa cez ňu nedá zistiť, čo kód dáva.
  if (promoCode) {
    const { data: valid, error: codeError } = await supabase.rpc(
      "promo_code_is_valid",
      { p_code: promoCode },
    );

    if (codeError || !valid) {
      return { error: t("promoCodeInvalid") };
    }
  }

  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Kód putuje v metadátach — trigger `handle_new_user` si ho overí sám
      // a podľa neho nastaví predplatné. Podvrhnuté metadáta bez platného
      // kódu nedajú nič.
      //
      // Trénerský účet patrí disciplíne NASADENIA, na ktorom vznikol (jeden
      // šport = jeden účet, docs §1.1). Podvrhnutá hodnota nedá nič — účet by
      // sa len zamkol v cudzej appke.
      data: {
        full_name: fullName,
        role: accountRole,
        promo_code: promoCode || null,
        discipline: accountRole === "coach" ? getDeploymentDiscipline() : null,
        self_diary: selfDiary,
      },
      // Potvrdzovací mail vedie späť na TENTO host (appka beží na viacerých),
      // rovnaká úvaha ako pri obnove hesla.
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(
        accountRole === "coach" ? "/" : "/parent",
      )}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // So zapnutým potvrdzovaním mailu Supabase session nevydá. Bez tejto vetvy
  // by človek skončil na stránke, kde to vyzerá, že sa nič nestalo.
  if (!data.session) {
    return { checkEmail: true };
  }

  redirect(accountRole === "coach" ? "/" : "/parent");
}

export async function logout(redirectTo: string = "/login") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(redirectTo);
}
