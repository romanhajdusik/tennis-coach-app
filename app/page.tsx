import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { DEFAULT_CATEGORY } from "@/lib/drill-options";
import { LandingPage, getLandingLocale } from "@/components/landing-page";
import { loadLandingMessages } from "@/lib/landing-locale";

// Marketingová landing page je jediná verejná stránka appky — root layout
// má defaultne robots noindex (appka je inak celá za prihlásením). Appka je
// zámerne zatiaľ mimo vyhľadávačov aj na vlastnej doméne (pred verejným
// spustením) — až pri ostrom launchi zmeniť na index:true. Landing page má
// vlastnú jazykovú vrstvu (SK/EN/DE/ES, lib/landing-locale.ts), nie
// next-intl "Landing" namespace — metadata preto čítajú z rovnakého zdroja.
export async function generateMetadata(): Promise<Metadata> {
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
    return <LandingPage />;
  }

  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          plan.log.analyze.win
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">plaw.win</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-zinc-600 dark:text-zinc-400">
          {t("loggedInAs")} <span className="font-medium">{user.email}</span>
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/players"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("players")}
          </Link>
          <Link
            href="/sessions"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("sessions")}
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("calendar")}
          </Link>
          <Link
            href="/drill-codes"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("drillCodes")}
          </Link>
          <Link
            href={`/analytics/${DEFAULT_CATEGORY}`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("analytics")}
          </Link>
          <Link
            href="/settings"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("settings")}
          </Link>
        </div>
        <form action={logout.bind(null, "/login")}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            {t("logout")}
          </button>
        </form>
      </div>
    </div>
  );
}
