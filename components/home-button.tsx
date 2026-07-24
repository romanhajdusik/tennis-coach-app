"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Cesty, na ktorých sa tlačidlo Domov nezobrazuje — buď ide o samotný
// rozcestník (tréner: "/", rodič/manažér/hráč: "/parent"), kde už "doma" si,
// alebo o verejné prihlasovacie/registračné stránky (na "/" pre odhláseného
// je landing page, tá je tiež v zozname).
const HIDDEN_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/parent",
  "/parent/login",
]);

// Globálne, vždy viditeľné plávajúce tlačidlo na rýchly návrat na rozcestník
// z ktorejkoľvek podstránky a z ktorejkoľvek pozície scrollu (fixné vľavo
// dole, oproti prepínaču jazyka vpravo dole).
export function HomeButton() {
  const pathname = usePathname();
  const t = useTranslations("Common");

  if (HIDDEN_PATHS.has(pathname)) {
    return null;
  }

  // Rodičovská časť appky má vlastný rozcestník na "/parent", tréner na "/".
  const href = pathname.startsWith("/parent") ? "/parent" : "/";

  return (
    <Link
      href={href}
      aria-label={t("home")}
      className="fixed bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
      {t("home")}
    </Link>
  );
}
