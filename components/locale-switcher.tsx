"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLocale } from "@/lib/actions/locale";
import type { AppLocale } from "@/i18n/request";

const LOCALES: AppLocale[] = ["sk", "en"];

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="fixed bottom-3 right-3 z-50 flex gap-1 rounded-full border border-zinc-300 bg-white/90 px-2 py-1 text-xs shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/90">
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          disabled={isPending || value === locale}
          onClick={() => {
            startTransition(async () => {
              await setLocale(value);
              router.refresh();
            });
          }}
          className={
            value === locale
              ? "font-semibold text-zinc-900 dark:text-zinc-50"
              : "text-zinc-500 underline dark:text-zinc-400"
          }
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
