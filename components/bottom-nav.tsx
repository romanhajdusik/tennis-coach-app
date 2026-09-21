"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AnalyticsNavIcon,
  CalendarNavIcon,
  HomeNavIcon,
  PlayersNavIcon,
  PracticesNavIcon,
} from "@/components/nav-icons";

// Verejné a prihlasovacie stránky, na ktoré môže prísť aj prihlásený tréner —
// lišta tam nepatrí. Či lištu vôbec kresliť (prihlásený tréner, nie šéftréner),
// rozhoduje server v `lib/coach-nav.ts`; tu sa rieši len adresa.
const HIDDEN_PATHS = new Set([
  "/login",
  "/register",
  "/join",
  "/forgot-password",
  "/reset-password",
  "/navod",
  "/navod-hrac",
  "/cennik-hrac",
  "/federacie",
]);
const HIDDEN_PREFIXES = ["/parent", "/director", "/auth"];

/**
 * Spodná lišta trénerovej appky (od 2026-09-21, návrh testerov) — nahradila
 * rad tlačidiel na domovskej stránke aj plávajúce tlačidlo „Home".
 *
 * Kreslí aj vlastnú **medzeru** na konci stránky, aby lišta neprekryla
 * posledný riadok obsahu; výšku drží `--bottom-nav-h` v globals.css.
 */
export function BottomNav({ analyticsHref }: { analyticsHref: string }) {
  const pathname = usePathname();
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");

  if (
    HIDDEN_PATHS.has(pathname) ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  const items = [
    { href: "/", label: tCommon("home"), Icon: HomeNavIcon, active: pathname === "/" },
    {
      href: "/players",
      label: t("players"),
      Icon: PlayersNavIcon,
      active: pathname.startsWith("/players"),
    },
    {
      href: "/sessions",
      label: t("sessions"),
      Icon: PracticesNavIcon,
      // Cudzí (prepojený) tréning je tiež tréning — patrí pod tú istú záložku.
      active:
        pathname.startsWith("/sessions") ||
        pathname.startsWith("/linked-sessions"),
    },
    {
      href: "/calendar",
      label: t("calendar"),
      Icon: CalendarNavIcon,
      active: pathname.startsWith("/calendar"),
    },
    {
      href: analyticsHref,
      label: t("analytics"),
      Icon: AnalyticsNavIcon,
      active: pathname.startsWith("/analytics"),
    },
  ];

  return (
    <>
      <div aria-hidden className="bottom-nav-spacer shrink-0" />
      <nav
        aria-label={t("mainNav")}
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-md justify-around pt-2.5">
          {items.map(({ href, label, Icon, active }) => (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex w-[70px] flex-col items-center gap-[3px] text-[11px] text-foreground ${
                active ? "font-semibold" : "font-medium"
              }`}
            >
              <span
                className={`flex h-9 w-[58px] items-center justify-center rounded-full ${
                  active ? "bg-primary/15" : ""
                }`}
              >
                <Icon />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
