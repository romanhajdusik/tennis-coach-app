"use server";

import { cookies } from "next/headers";
import { isValidTimeZone } from "@/i18n/request";

export async function setTimeZone(timeZone: string) {
  if (!isValidTimeZone(timeZone)) return;

  const cookieStore = await cookies();
  cookieStore.set("NEXT_TIMEZONE", timeZone, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
