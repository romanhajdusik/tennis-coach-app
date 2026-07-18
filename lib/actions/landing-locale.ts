"use server";

import { cookies } from "next/headers";
import type { LandingLocale } from "@/lib/landing-locale";

export async function setLandingLocale(locale: LandingLocale) {
  const cookieStore = await cookies();
  cookieStore.set("LANDING_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
