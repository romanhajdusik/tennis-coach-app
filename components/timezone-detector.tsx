"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTimeZone } from "next-intl";
import { setTimeZone } from "@/lib/actions/timezone";

// Neviditeľná — jednorazovo zistí časové pásmo prehliadača a uloží ho,
// ak sa líši od toho, čo appka práve používa (napr. prvá návšteva, alebo
// používateľ cestuje a zariadenie si prepnulo pásmo). Rovnaký princíp ako
// LocaleSwitcher, len bez UI a bez ručného výberu — deje sa to samo.
export function TimezoneDetector() {
  const current = useTimeZone();
  const router = useRouter();

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== current) {
      setTimeZone(detected).then(() => router.refresh());
    }
  }, [current, router]);

  return null;
}
