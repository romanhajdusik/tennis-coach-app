import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { DEFAULT_CATEGORY } from "@/lib/drill-options";
import { LandingPage, getLandingLocale } from "@/components/landing-page";
import { loadLandingMessages } from "@/lib/landing-locale";
import { getOrgContext } from "@/lib/org/context";

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
    return <LandingPage />;
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
        <p className="text-xs text-muted ">{org ? `${org.slug}.plaw.win` : "plaw.win"}</p>
        {org && (
          <p className="mt-2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            {org.name}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted ">
          {t("loggedInAs")} <span className="font-medium">{user.email}</span>
        </p>
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
