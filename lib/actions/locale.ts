"use server";

import { cookies } from "next/headers";
import type { AppLocale } from "@/i18n/request";

export async function setLocale(locale: AppLocale) {
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
