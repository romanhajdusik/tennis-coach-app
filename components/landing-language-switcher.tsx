"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLandingLocale } from "@/lib/actions/landing-locale";
import { LANDING_LOCALES, type LandingLocale } from "@/lib/landing-locale";

export function LandingLanguageSwitcher({
  currentLocale,
  // Rozcestník na plaw.online je len SK/EN, nie 9-jazyčný ako landing — vie si
  // preto vypýtať užší zoznam. Bez tohto by ponúkal jazyky, v ktorých stránka
  // neexistuje.
  locales = LANDING_LOCALES,
}: {
  currentLocale: LandingLocale;
  locales?: readonly LandingLocale[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap justify-end gap-1 rounded-2xl border border-zinc-200 bg-white/80 px-1.5 py-1 text-xs backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      {locales.map((value) => (
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
