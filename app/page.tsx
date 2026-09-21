import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { getDiscipline } from "@/lib/discipline";
import { LandingPage } from "@/components/landing-page";
import { PublicFaceHome } from "@/components/public-face-home";
import { LandingHrac } from "@/components/landing-hrac";
import { isParentFaceHost, isPublicFaceHost } from "@/lib/public-face";
import {
  loadLandingHracMessages,
  loadLandingMessages,
  loadRozcestnikMessages,
} from "@/lib/landing-locale";
import { getOrgContext } from "@/lib/org/context";
import { getOrgMembership, getOrgRole } from "@/lib/org/membership";
import { PlayerSwitcher } from "@/components/player-switcher";
import { TodayBoard } from "@/components/today-board";
import { TagIcon } from "@/components/landing-icons";
import { LogoutIcon } from "@/components/nav-icons";

// Marketingová landing page je jediná verejná stránka appky — root layout
// má defaultne robots noindex (appka je inak celá za prihlásením). Appka je
// zámerne zatiaľ mimo vyhľadávačov aj na vlastnej doméne (pred verejným
// spustením) — až pri ostrom launchi zmeniť na index:true. Landing page má
// vlastnú textovú vrstvu (lib/landing-locale.ts, messages/en), nie appkový
// next-intl "Landing" namespace — metadata preto čítajú z rovnakého zdroja.
export async function generateMetadata(): Promise<Metadata> {
  // Na subdoméne organizácie je to jej pracovný nástroj, nie marketing —
  // titulok preto nesie názov organizácie.
  const org = await getOrgContext();
  if (org) {
    return { title: org.name, robots: { index: false, follow: false } };
  }

  // plaw.click má na `/` landing pre hráča, rodiča a manažéra. Je pred
  // kontrolou disciplíny zámerne: tá stránka je bez tenisového slovníka, takže
  // platí pre sledujúceho tenistu aj kondičného hráča.
  const host = (await headers()).get("host");
  if (isParentFaceHost(host)) {
    const t = await loadLandingHracMessages();
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: { index: false, follow: false },
    };
  }

  // Verejná tvár (plaw.online) má na `/` rozcestník, nie consumer landing —
  // metadata musia sedieť s tým, čo sa naozaj vykreslí.
  if (isPublicFaceHost(host)) {
    const t = await loadRozcestnikMessages();
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: { index: false, follow: false },
    };
  }

  // Landing texty sú marketing TENISOVÉHO produktu, takže by inej disciplíne
  // dali do karty prehliadača cudziu vetu („Practices under control. Right
  // there on the court."). Tá dostane neutrálny názov appky — ten istý, aký
  // nesie ikona na ploche.
  if ((await getDiscipline()) !== "tennis") {
    const tCommon = await getTranslations("Common");
    return {
      title: tCommon("appTitle"),
      description: tCommon("appDescription"),
      robots: { index: false, follow: false },
    };
  }

  const t = await loadLandingMessages();
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
    const host = (await headers()).get("host");
    // plaw.click hovorí druhej strane appky (hráč, rodič, manažér). Stojí PRED
    // kontrolou disciplíny, lebo tá doména visí výhradne na tenisovom nasadení
    // — kondička vlastný marketing nemá a túto stránku by ani použiť nemohla,
    // odkedy menuje tenis (rodič kondičné tréningy nevidí, viď landing-locale).
    if (isParentFaceHost(host)) {
      return <LandingHrac />;
    }
    // Verejná tvár ponúka oba produkty ako rovnocenné dvere; consumer landing
    // (funkcie, screenshoty, cenník) ostáva na plaw.win, kam prvé dvere vedú.
    if (isPublicFaceHost(host)) {
      return <PublicFaceHome />;
    }
    // Landing je marketing TENISOVÉHO produktu (jeho názov, screenshoty
    // z kurtu, cenník). Iná disciplína ju nesmie vykresliť ani omylom —
    // kondičný tréner na `fitness.plawsports.com` sem chodí pracovať,
    // nie čítať o tenise. Vlastný marketing kondička zatiaľ nemá.
    if ((await getDiscipline()) !== "tennis") {
      redirect("/login");
    }
    return <LandingPage />;
  }

  // Šéftréner federácie nemá pridelených hráčov — nástenka „Dnes" by mu
  // ukázala prázdny rozvrh. Jeho domov je riadiaci pult.
  if (org && (await getOrgRole(supabase, user.id)) === "director") {
    redirect("/director");
  }

  // Denný domov „Dnes" dostane KAŽDÝ tréner (od 2026-09-21) — aj s jediným
  // hráčom a aj nový bez hráčov. Dovtedy ho mali len tréneri s 2+ hráčmi a
  // ostatní videli rozcestník s radom tlačidiel; tie sú odvtedy v spodnej
  // lište (`components/bottom-nav.tsx`), takže by rozcestník ostal prázdny.
  //
  // POZOR — jediná výnimka: člen organizácie MIMO jej subdomény. RLS sa pýta
  // na ČLENSTVO, nie na hostname (`current_org_id()` číta
  // `organization_members`), takže nástenka by mu aj na `plaw.win` vykreslila
  // hráčov organizácie. Osobných hráčov taký účet mať nemôže (buď nezávislý,
  // alebo zamestnanec), preto dostane len údaj, kto je prihlásený.
  const showBoard = org !== null || (await getOrgMembership()) === null;

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <HomeHeader
        title={t("title")}
        drillCodesLabel={t("drillCodes")}
        logoutLabel={t("logout")}
      />

      {showBoard ? (
        <>
          <TodayBoard org={org} />
          <PlayerSwitcher
            heading={t("players")}
            singlePlaceholder={t("playerPlaceholder")}
          />
        </>
      ) : (
        <p className="text-sm text-muted">
          {t("loggedInAs")}{" "}
          <span className="font-medium text-foreground">{user.email}</span>
        </p>
      )}
    </div>
  );
}

const ICON_ITEM =
  "group flex w-[70px] flex-col items-center gap-1 text-[11px] font-medium text-foreground";
const ICON_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors group-hover:text-foreground";

/**
 * Hlavička domovskej stránky: značka vľavo, kódy cvičení a odhlásenie vpravo.
 * Oboje žilo do 2026-09-21 v rade tlačidiel pod nástenkou; v spodnej lište
 * nie sú, lebo tam je miesto na päť najpoužívanejších obrazoviek.
 */
function HomeHeader({
  title,
  drillCodesLabel,
  logoutLabel,
}: {
  title: string;
  drillCodesLabel: string;
  logoutLabel: string;
}) {
  // Bodky v „P.L.A.W" nesú primárnu farbu appky (tenis limetková).
  const letters = title.split(".");

  return (
    <header className="flex items-center justify-between">
      <span className="font-sans text-[22px] font-extrabold tracking-tight text-foreground">
        {letters.map((letter, index) => (
          <Fragment key={index}>
            {index > 0 && <span className="text-primary">.</span>}
            {letter}
          </Fragment>
        ))}
      </span>
      {/* Popisok pod ikonkou ako v spodnej lište (používateľ, 2026-09-21) —
          samotná ikonka štítku nehovorí, že ide o kódy cvičení. */}
      <div className="flex gap-3">
        <Link href="/drill-codes" className={ICON_ITEM}>
          <span className={ICON_BUTTON}>
            <TagIcon className="h-5 w-5" />
          </span>
          {drillCodesLabel}
        </Link>
        <form action={logout.bind(null, "/login")}>
          <button type="submit" className={ICON_ITEM}>
            <span className={ICON_BUTTON}>
              <LogoutIcon />
            </span>
            {logoutLabel}
          </button>
        </form>
      </div>
    </header>
  );
}
