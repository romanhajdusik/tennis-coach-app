import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { DEFAULT_CATEGORY } from "@/lib/drill-options";
import { LandingPage, getLandingLocale } from "@/components/landing-page";
import { PublicFaceHome } from "@/components/public-face-home";
import { isPublicFaceHost } from "@/lib/public-face";
import {
  loadLandingMessages,
  loadRozcestnikMessages,
  rozcestnikLocale,
} from "@/lib/landing-locale";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";
import { PlayerSwitcher } from "@/components/player-switcher";
import { TodayBoard } from "@/components/today-board";

// Rozcestník federačného trénera — tie isté obrazovky ako v samostatnom
// režime, len pod dennou nástenkou „Dnes".
const NAV_LINKS = [
  { href: "/players", labelKey: "players" },
  { href: "/sessions", labelKey: "sessions" },
  { href: "/calendar", labelKey: "calendar" },
  { href: "/drill-codes", labelKey: "drillCodes" },
  { href: `/analytics/${DEFAULT_CATEGORY}`, labelKey: "analytics" },
  { href: "/settings", labelKey: "settings" },
] as const;

// Marketingová landing page je jediná verejná stránka appky — root layout
// má defaultne robots noindex (appka je inak celá za prihlásením). Appka je
// zámerne zatiaľ mimo vyhľadávačov aj na vlastnej doméne (pred verejným
// spustením) — až pri ostrom launchi zmeniť na index:true. Landing page má
// vlastnú jazykovú vrstvu (SK/EN/DE/ES, lib/landing-locale.ts), nie
// next-intl "Landing" namespace — metadata preto čítajú z rovnakého zdroja.
export async function generateMetadata(): Promise<Metadata> {
  // Na subdoméne organizácie je to jej pracovný nástroj, nie marketing —
  // titulok preto nesie názov organizácie.
  const org = await getOrgContext();
  if (org) {
    return { title: org.name, robots: { index: false, follow: false } };
  }

  // Verejná tvár (plaw.online) má na `/` rozcestník, nie consumer landing —
  // metadata musia sedieť s tým, čo sa naozaj vykreslí.
  if (isPublicFaceHost((await headers()).get("host"))) {
    const t = await loadRozcestnikMessages(
      rozcestnikLocale(await getLandingLocale()),
    );
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: { index: false, follow: false },
    };
  }

  const locale = await getLandingLocale();
  const t = await loadLandingMessages(locale);
  return {
    title: t.heroTitle,
    description: t.heroSubtitle,
    robots: { index: false, follow: false },
  };
}

export default async function Home() {
  const t = await getTranslations("Home");
  const org = await getOrgContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // Rodič/manažér nemá vlastných hráčov, ide na svoju samostatnú časť
    // appky — kým sa nepripojí na trénera cez kód, uvidí tam rovno
    // formulár na jeho zadanie (app/parent/page.tsx).
    if (profile && profile.role !== "coach") {
      redirect("/parent");
    }
  }

  if (!user) {
    // Subdoména organizácie nemá marketingovú landing — federačný tréner sem
    // chodí pracovať, nie čítať o produkte (marketing žije na plaw.online).
    if (org) {
      redirect("/login");
    }
    // Verejná tvár ponúka oba produkty ako rovnocenné dvere; consumer landing
    // (funkcie, screenshoty, cenník) ostáva na plaw.win, kam prvé dvere vedú.
    if (isPublicFaceHost((await headers()).get("host"))) {
      return <PublicFaceHome />;
    }
    return <LandingPage />;
  }

  // Šéftréner federácie nemá pridelených hráčov — nástenka „Dnes" by mu
  // ukázala prázdny rozvrh. Jeho domov je riadiaci pult.
  if (org && (await getOrgRole(supabase, user.id)) === "director") {
    redirect("/director");
  }

  // Federačný tréner (1:N) má denný domov „Dnes" — rozvrh naprieč hráčmi.
  // Samostatný (1:1) tréner ho nepotrebuje, jeho rozcestník ostáva ako bol.
  if (org) {
    return (
      <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
        <TodayBoard org={org} />

        <PlayerSwitcher />

        <nav className="flex flex-wrap gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>

        <form action={logout.bind(null, "/login")}>
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium "
          >
            {t("logout")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-col items-center justify-center gap-6 bg-background px-4 ">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <p className="text-xs text-muted ">
          plan.log.analyze.win
        </p>
        <p className="text-xs text-muted ">plaw.win</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted ">
          {t("loggedInAs")} <span className="font-medium">{user.email}</span>
        </p>
        <div className="w-full max-w-md">
          <PlayerSwitcher />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/players"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("players")}
          </Link>
          <Link
            href="/sessions"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("sessions")}
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("calendar")}
          </Link>
          <Link
            href="/drill-codes"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("drillCodes")}
          </Link>
          <Link
            href={`/analytics/${DEFAULT_CATEGORY}`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("analytics")}
          </Link>
          <Link
            href="/settings"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("settings")}
          </Link>
        </div>
        <form action={logout.bind(null, "/login")}>
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium "
          >
            {t("logout")}
          </button>
        </form>
      </div>
    </div>
  );
}
