// Landing page má vlastnú, samostatnú jazykovú vrstvu (SK/EN/DE/ES/RU/FR/ZH/IT/JA),
// oddelenú od appky (i18n/request.ts, len SK/EN). Appka ako celok sa
// neprekladá do týchto ďalších jazykov — len táto verejná marketingová
// stránka a návody, preto vlastný cookie a vlastný loader mimo next-intl.
// Poradie v prepínači jazykov (landing + návody). EN je prvé a je to
// predvolený jazyk (defaultLandingLocale nižšie). SK je zámerne posledné.
export const LANDING_LOCALES = [
  "en",
  "de",
  "es",
  "ru",
  "fr",
  "zh",
  "it",
  "ja",
  "sk",
] as const;
export type LandingLocale = (typeof LANDING_LOCALES)[number];
export const defaultLandingLocale: LandingLocale = "en";

export function isValidLandingLocale(
  value: string | undefined,
): value is LandingLocale {
  return !!value && (LANDING_LOCALES as readonly string[]).includes(value);
}

export async function loadLandingMessages(locale: LandingLocale) {
  const messages = await import(`../messages/${locale}/landing.json`);
  return messages.default as {
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    /**
     * Tri heslá v hero (nadpis + veta). Majú ich len SK a EN — ostatné jazyky
     * vykreslia pôvodný hero s `heroTitle`/`heroSubtitle`. `heroTitle` ostáva
     * v každom jazyku, lebo z neho vychádza aj titulok stránky.
     */
    heroPoints?: { title: string; text: string }[];
    ctaPrimary: string;
    ctaSecondary: string;
    guideLink: string;
    guideCoach: string;
    guidePlayer: string;
    showcaseTitle: string;
    showcaseSubtitle: string;
    showcaseCaptions: { calendar: string; session: string; analytics: string };
    featuresTitle: string;
    features: { title: string; description: string }[];
    pricingTitle: string;
    pricingSubtitle: string;
    pricingMonthly: string;
    pricingYearly: string;
    pricingYearlySave: string;
    pricingPerMonth: string;
    /** „(82,80 € za rok)" pri mesačnej cene — mesačná × 12. */
    pricingMonthlyYearTotal: string;
    pricingPerYear: string;
    pricingYearlyNote: string;
    pricingPerDay: string;
    /** Počet hráčov na hladinu — preložený, lebo pluralita je vec jazyka. */
    pricingPlayerCounts: string[];
    pricingRecommended: string;
    pricingCompareTitle: string;
    pricingCompareWithoutSub: string;
    pricingComparePaid: string;
    pricingCompareRows: string[];
    pricingCompareNote: string;
    pricingVat: string;
    pricingFollowerText: string;
    pricingFollowerCta: string;
    pricingCta: string;
    finalCtaTitle: string;
    finalCtaSubtitle: string;
    finalCtaButton: string;
    footerTagline: string;
  };
}

// Návod (stránka /navod) používa tú istú jazykovú vrstvu ako landing page
// (LANDING_LOCALE, 9 jazykov), nie appkové next-intl SK/EN — je to verejná
// časť webu plaw.online popri landingu.
export type NavodMessages = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  backToHome: string;
  stepWord: string;
  steps: { title: string; body: string }[];
  tipsTitle: string;
  tips: string[];
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
  crossLinkText: string;
  crossLinkCta: string;
  // Len /navod-hrac: odkaz na cenník pre hráča, rodiča a manažéra.
  // Trénerský návod tieto kľúče nemá, preto sú nepovinné.
  pricingLinkText?: string;
  pricingLinkCta?: string;
};

export async function loadNavodMessages(
  locale: LandingLocale,
): Promise<NavodMessages> {
  const messages = await import(`../messages/${locale}/navod.json`);
  return messages.default as NavodMessages;
}

// Krátky návod pre pripojeného hráča/rodiča/manažéra (/navod-hrac) — rovnaká
// štruktúra aj jazyková vrstva ako trénerský návod.
export async function loadNavodHracMessages(
  locale: LandingLocale,
): Promise<NavodMessages> {
  const messages = await import(`../messages/${locale}/navod-hrac.json`);
  return messages.default as NavodMessages;
}

// Cenník pre hráča, rodiča a manažéra (/cennik-hrac) je zámerne SAMOSTATNÁ
// stránka, nie sekcia landingu: tréner platí za hráča menej než rodič
// (4,1–4,6 vs. 9,9 centa denne), lebo platí za viacerých naraz — vedľa seba
// v jednej tabuľke by to vyzeralo, že rodič má menej funkcií za viac peňazí
// (docs/cennik-navrh.md §8.2). Sú to aj dve rôzne otázky: „koľko ma to stojí
// pri mojom počte hráčov" a „oplatí sa mi vidieť, čo dieťa trénuje".
//
// Texty sú zámerne bez tenisu (žiadny kurt ani úder) — tú istú stránku
// dostane aj rodič kondičného hráča.
export type CennikHracMessages = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  backToHome: string;
  title: string;
  subtitle: string;
  yearlyLabel: string;
  monthlyLabel: string;
  perYear: string;
  perMonth: string;
  monthlyYearTotal: string;
  perDay: string;
  yearlyNote: string;
  trialNote: string;
  vat: string;
  compareTitle: string;
  compareSubtitle: string;
  compareWithoutSub: string;
  comparePaid: string;
  compareRows: string[];
  notesTitle: string;
  notes: string[];
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
  crossLinkText: string;
  crossLinkCta: string;
};

export async function loadCennikHracMessages(
  locale: LandingLocale,
): Promise<CennikHracMessages> {
  const messages = await import(`../messages/${locale}/cennik-hrac.json`);
  return messages.default as CennikHracMessages;
}

// Landing pre hráča, rodiča a manažéra (`plaw.click`, od 2026-08-22) — druhá
// strana appky konečne dostala vlastný PREDAJ, nie len vysvetlenie: dovtedy
// mala iba návod (`/navod-hrac`) a cenník (`/cennik-hrac`), kým celý ostatný
// verejný web hovoril k trénerovi.
//
// **Menuje tenis** (rozhodnuté 2026-08-22) — na rozdiel od /cennik-hrac, ktorý
// je zámerne bez tenisového slovníka. Dôvod je vecný, nie marketingový: rodič
// vidí len kópie JEDNEJ karty, takže KONDIČNÉ tréningy hráča nevidí (tie sú
// cross-read cez prepojenie kariet a ten má výhradne tréner, pozri
// lib/players/linked.ts). Veta "každý tréning hráča" by teda sľubovala viac,
// než appka dá. Ak raz kondička dostane vlastný marketing, táto stránka sa
// pre ňu nedá použiť tak, ako je.
//
// POZOR na dve veci pri úpravách textov (rozhodnuté v CLAUDE.md, sekcia
// „Ceny na verejnom webe" a pri nápade na túto stránku):
// 1. **Nič sa nesmie sľubovať zadarmo** — jediné dovolené tvrdenie je 14 dní
//    na skúšku a že potom sa platí.
// 2. **Kalendár a analytika sú za predplatným**, takže sa nesmú spomínať ako
//    samozrejmosť; ktoré dlaždice to sú, drží pole `PAID_FEATURES`
//    v `components/landing-hrac.tsx`, nie preklady.
// 3. **Prenos histórie na nového trénera neexistuje a nebude** (jediná policy
//    na `parent_session_records` je `parent_id = auth.uid()`), takže veta
//    o transparentnosti smie sľubovať len nahliadnutie u sledujúceho.
export type LandingHracMessages = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  howTitle: string;
  howSubtitle: string;
  stepWord: string;
  steps: { title: string; body: string }[];
  showcaseTitle: string;
  showcaseSubtitle: string;
  /**
   * Zábery kalendára a analytiky ukazujú funkcie ZA PREDPLATNÝM, takže pod
   * nimi musí stáť veta, ktorá to povie — inak sekcia sľubuje viac, než
   * sledujúci bez predplatného dostane.
   */
  showcaseNote: string;
  showcaseCaptions: { calendar: string; session: string; analytics: string };
  featuresTitle: string;
  /** Štítok na dlaždiciach, ktoré sú za predplatným (kalendár, analytika). */
  featurePaidBadge: string;
  features: { title: string; description: string }[];
  transparencyTitle: string;
  transparencyIntro: string;
  transparencyQuote: string;
  transparencyNote: string;
  pricingTitle: string;
  pricingSubtitle: string;
  pricingPerYear: string;
  pricingPerDay: string;
  pricingTrial: string;
  pricingFree: string;
  pricingOnePlayer: string;
  pricingVat: string;
  pricingCta: string;
  finalCtaTitle: string;
  finalCtaSubtitle: string;
  finalCtaButton: string;
  guideText: string;
  guideCta: string;
  coachText: string;
  coachCta: string;
  footerTagline: string;
};

export async function loadLandingHracMessages(
  locale: LandingLocale,
): Promise<LandingHracMessages> {
  const messages = await import(`../messages/${locale}/landing-hrac.json`);
  return messages.default as LandingHracMessages;
}

// Stránka pre federácie/kluby/akadémie (/federacie) je zámerne LEN po slovensky
// — prvými B2B zákazníkmi sú slovenské zväzy a kluby a obchod sa vedie po
// slovensky. Preto nemá `locale` parameter ani prepínač jazykov; keby raz
// pribudol ďalší jazyk, stačí sem doplniť parameter ako pri návodoch.
export type FederacieMessages = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  backToHome: string;
  title: string;
  subtitle: string;
  featuresTitle: string;
  features: { title: string; description: string }[];
  howTitle: string;
  stepWord: string;
  steps: { title: string; body: string }[];
  notesTitle: string;
  notes: string[];
  pricingBadge: string;
  pricingTitle: string;
  pricingText: string;
  footerTagline: string;
};

export async function loadFederacieMessages(): Promise<FederacieMessages> {
  const messages = await import("../messages/sk/federacie.json");
  return messages.default as FederacieMessages;
}

// Rozcestník na plaw.online (verejná tvár): **troje dvere** — tréner na
// plaw.win, sledujúci (hráč, rodič, manažér) na plaw.click a federačná
// stránka. Tretie dvere pribudli 2026-08-22 spolu s doménou plaw.click:
// dovtedy viedli prvé dvere „tréner, hráč, rodič, manažér" všetkých na
// trénerský marketing, čo pre sledujúceho nikdy nesedelo. Je len **SK/EN**, nie 9-jazyčný ako landing:
// za jednými dverami je slovenská stránka pre federácie a rozcestník je len
// pár viet. Kto má v cookie iný jazyk, dostane angličtinu.
export type RozcestnikLocale = "sk" | "en";

export function rozcestnikLocale(locale: LandingLocale): RozcestnikLocale {
  return locale === "sk" ? "sk" : "en";
}

export type RozcestnikMessages = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  subtitle: string;
  consumerTitle: string;
  consumerText: string;
  consumerCta: string;
  followerTitle: string;
  followerText: string;
  followerCta: string;
  orgTitle: string;
  orgText: string;
  orgCta: string;
  guidesTitle: string;
  guideCoach: string;
  guidePlayer: string;
  footerTagline: string;
};

export async function loadRozcestnikMessages(
  locale: RozcestnikLocale,
): Promise<RozcestnikMessages> {
  const messages = await import(`../messages/${locale}/rozcestnik.json`);
  return messages.default as RozcestnikMessages;
}
