import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { getDiscipline, getDisciplineConfig } from "@/lib/discipline";
import { LandingPage } from "@/components/landing-page";
import { DisciplineIntro } from "@/components/discipline-intro";
import { LandingFitness } from "@/components/landing-fitness";
import { LandingPadel } from "@/components/landing-padel";
import { LandingBadminton } from "@/components/landing-badminton";
import { LandingPickleball } from "@/components/landing-pickleball";
import { PublicFaceHome } from "@/components/public-face-home";
import { LandingHrac } from "@/components/landing-hrac";
import {
  isParentFaceHost,
  isPublicFaceHost,
  isSportsHubHost,
} from "@/lib/public-face";
import { SportsHub } from "@/components/sports-hub";
import { PublicAnalytics } from "@/components/public-analytics";
import { ogFaceOf, ogMetadata } from "@/lib/og";
import {
  loadLandingFitnessMessages,
  loadLandingHracMessages,
  loadLandingPadelMessages,
  loadLandingBadmintonMessages,
  loadLandingPickleballMessages,
  loadLandingMessages,
  loadRozcestnikMessages,
  loadSportsHubMessages,
} from "@/lib/landing-locale";
import { getOrgContext } from "@/lib/org/context";
import { getOrgMembership, getOrgRole } from "@/lib/org/membership";
import { PlayerSwitcher } from "@/components/player-switcher";
import { TodayBoard } from "@/components/today-board";
import { TagIcon } from "@/components/landing-icons";
import { LogoutIcon, SettingsIcon } from "@/components/nav-icons";
import { publicRobots } from "@/lib/seo";
import { isSelfDiary } from "@/lib/self-diary";

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
  // plawsports.com = rozcestník športov (od 2026-10-07).
  if (isSportsHubHost(host)) {
    const t = await loadSportsHubMessages();
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: publicRobots(),
      ...ogMetadata({
        face: "hub",
        title: t.metaTitle,
        description: t.metaDescription,
      }),
    };
  }
  if (isParentFaceHost(host)) {
    const t = await loadLandingHracMessages();
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: publicRobots(),
      ...ogMetadata({
        face: "parent",
        title: t.metaTitle,
        description: t.metaDescription,
      }),
    };
  }

  // Verejná tvár (plaw.online) má na `/` rozcestník, nie consumer landing —
  // metadata musia sedieť s tým, čo sa naozaj vykreslí.
  if (isPublicFaceHost(host)) {
    const t = await loadRozcestnikMessages();
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: publicRobots(),
      ...ogMetadata({
        face: "org",
        title: t.metaTitle,
        description: t.metaDescription,
      }),
    };
  }

  // Landing texty sú marketing TENISOVÉHO produktu, takže by inej disciplíne
  // dali do karty prehliadača cudziu vetu („Practices under control. Right
  // there on the court."). Tá dostane neutrálny názov appky — ten istý, aký
  // nesie ikona na ploche.
  const discipline = await getDiscipline();
  if (
    discipline === "fitness" ||
    discipline === "padel" ||
    discipline === "badminton" ||
    discipline === "pickleball"
  ) {
    const t =
      discipline === "padel"
        ? await loadLandingPadelMessages()
        : discipline === "badminton"
          ? await loadLandingBadmintonMessages()
          : discipline === "pickleball"
            ? await loadLandingPickleballMessages()
            : await loadLandingFitnessMessages();
    return {
      title: t.metaTitle,
      description: t.metaDescription,
      robots: publicRobots(),
      ...ogMetadata({
        face: ogFaceOf(host),
        title: t.metaTitle,
        description: t.metaDescription,
      }),
    };
  }
  if (discipline !== "tennis") {
    const tCommon = await getTranslations("Common");
    return {
      title: tCommon("appTitle"),
      description: tCommon("appDescription"),
      robots: publicRobots(),
      ...ogMetadata({
        face: ogFaceOf(host),
        title: tCommon("appTitle"),
        description: tCommon("appDescription"),
      }),
    };
  }

  const t = await loadLandingMessages();
  return {
    title: t.heroTitle,
    description: t.heroSubtitle,
    robots: publicRobots(),
    ...ogMetadata({
      face: "coach",
      title: t.heroTitle,
      description: t.heroSubtitle,
    }),
  };
}

// Meranie návštevnosti len pre ODHLÁSENÉHO (verejný landing) — prihlásený
// na `/` dostane nástenku a tá sa nemeria, viď `components/public-analytics.tsx`.
function withAnalytics(page: ReactNode) {
  return (
    <>
      {page}
      <PublicAnalytics />
    </>
  );
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
    // plawsports.com = rozcestník športov (od 2026-10-07) — výber appky, nie
    // marketing žiadneho jedného športu.
    if (isSportsHubHost(host)) {
      return withAnalytics(<SportsHub />);
    }
    if (isParentFaceHost(host)) {
      return withAnalytics(<LandingHrac />);
    }
    // Verejná tvár ponúka oba produkty ako rovnocenné dvere; consumer landing
    // (funkcie, screenshoty, cenník) ostáva na plaw.win, kam prvé dvere vedú.
    if (isPublicFaceHost(host)) {
      return withAnalytics(<PublicFaceHome />);
    }
    // Landing je marketing TENISOVÉHO produktu (jeho názov, screenshoty
    // z kurtu, cenník). Iná disciplína ju nesmie vykresliť ani omylom —
    // kondičný tréner na `fitness.plawsports.com` sem chodí pracovať,
    // nie čítať o tenise. Kondička má vlastný krátky landing (nižšie);
    // iná disciplína by dostala úvodnú obrazovku bez sľubov, ak ju
    // konfigurácia má, inak prihlásenie.
    const config = await getDisciplineConfig();
    // Kondička má od 2026-10-02 vlastný krátky landing s cenníkom — dovtedy
    // len úvodnú obrazovku bez sľubov, takže kondičný tréner cenu nevidel
    // nikde. Ostatné disciplíny (dnes žiadna) majú úvod alebo prihlásenie.
    if (config.id === "fitness") {
      return withAnalytics(<LandingFitness config={config} />);
    }
    // Padel má od 2026-10-05 vlastný landing — každý šport svoj, nie spoločný
    // (rozhodol user). Rovnako bedminton a pickleball.
    if (config.id === "padel") {
      return withAnalytics(<LandingPadel config={config} />);
    }
    if (config.id === "badminton") {
      return withAnalytics(<LandingBadminton config={config} />);
    }
    if (config.id === "pickleball") {
      return withAnalytics(<LandingPickleball config={config} />);
    }
    if (config.id !== "tennis") {
      if (config.intro) {
        return withAnalytics(
          <DisciplineIntro
            photo={config.intro.photo}
            label={config.label}
            domain={config.domain}
          />
        );
      }
      redirect("/login");
    }
    return withAnalytics(<LandingPage />);
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
        settingsLabel={t("settings")}
        logoutLabel={t("logout")}
      />

      {showBoard ? (
        <>
          <TodayBoard org={org} />
          {/* Hráčsky denník (docs §6) má jedinú kartu — seba. Prepínač
              s ním samým a prázdnym miestom pre ďalšieho by klamal. */}
          {!(await isSelfDiary()) && (
            <PlayerSwitcher
              heading={t("players")}
              singlePlaceholder={t("playerPlaceholder")}
            />
          )}
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
  settingsLabel,
  logoutLabel,
}: {
  title: string;
  drillCodesLabel: string;
  settingsLabel: string;
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
      {/* Odstup je `gap-1`, nie `gap-3`: od tretej ikonky (nastavenia, 2026-09-25)
          rad pri šírke 320 px pretekal, a užšie položky by zalomili popisok
          „Drill codes" na dva riadky. */}
      <div className="flex gap-1">
        <Link href="/drill-codes" className={ICON_ITEM}>
          <span className={ICON_BUTTON}>
            <TagIcon className="h-5 w-5" />
          </span>
          {drillCodesLabel}
        </Link>
        <Link href="/settings" className={ICON_ITEM}>
          <span className={ICON_BUTTON}>
            <SettingsIcon />
          </span>
          {settingsLabel}
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
