"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string } | undefined;

export async function login(
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

  redirect("/");
}

export async function register(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;
  const t = await getTranslations("Auth.errors");

  if (process.env.REGISTRATION_ENABLED !== "true") {
    return { error: t("registrationClosed") };
  }

  if (!fullName || !email || !password || !role) {
    return { error: t("missingRegisterFields") };
  }

  if (!["coach", "parent", "manager"].includes(role)) {
    return { error: t("invalidRole") };
  }

  if (password.length < 8) {
    return { error: t("passwordTooShort") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
