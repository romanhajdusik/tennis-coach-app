"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLandingLocale } from "@/lib/actions/landing-locale";
import { LANDING_LOCALES, type LandingLocale } from "@/lib/landing-locale";

export function LandingLanguageSwitcher({
  currentLocale,
}: {
  currentLocale: LandingLocale;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-1 rounded-full border border-zinc-200 bg-white/80 px-1.5 py-1 text-xs backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      {LANDING_LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          disabled={isPending || value === currentLocale}
          onClick={() => {
            startTransition(async () => {
              await setLandingLocale(value);
              router.refresh();
            });
          }}
          className={
            value === currentLocale
              ? "rounded-full bg-zinc-900 px-2 py-1 font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "rounded-full px-2 py-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          }
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
