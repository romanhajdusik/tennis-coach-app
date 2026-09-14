// Verejný web (landing, oba návody, cenník pre sledujúceho, stránka pre
// federácie, rozcestník) má vlastné message súbory MIMO next-intl — appka ide
// cez `i18n/request.ts`, tieto stránky nie. Ostalo to tak aj po zjednotení
// jazyka: sú to marketingové texty, ktoré sa menia inak než produktové.
//
// **JAZYK JE OD 2026-09-14 VÝHRADNE ANGLICKÝ A PREPÍNAČ NEEXISTUJE** (rozhodol
// user). Dovtedy tu bolo deväť jazykov (EN/DE/ES/RU/FR/ZH/IT/JA/SK), cookie
// `LANDING_LOCALE`, prepínač v hlavičke každej verejnej stránky a prenos jazyka
// v adrese (`?lang=`) medzi doménami. Padlo to celé a dôvody si drž:
//   1. **Appka hovorí len anglicky.** Deväťjazyčný web sľuboval lokalizovaný
//      produkt, ktorý neexistuje — nemecký landing viedol do anglickej appky.
//   2. **Web je `noindex`**, takže tie jazyky neprinášali ani návštevnosť
//      z vyhľadávačov, čo bol jediný dôvod mať ich pripravené vopred.
//   3. **Nedali sa skontrolovať.** Jedna nepravdivá veta o mazaní rodičovských
//      kópií sedela 2026-09-13 vo všetkých deviatich súboroch naraz a v `ja`,
//      `zh` a `ru` ju nemal kto prečítať.
// Slovenskému rodičovi stránku preloží človek, nie appka (rozhodol user).
//
// Slovenčina ostáva **interným** jazykom projektu (CLAUDE.md, `docs/`,
// komentáre, commit messages), nie jazykom produktu. Posledné znenie
// slovenských verejných textov je v `docs/verejny-web-sk-archiv.md` — je to
// archív, nie preklad, a neudržiava sa.
//
// **Keby jazyky raz pribúdali, vracajú sa SEM** (loader + parameter), nie
// vetvením po jednotlivých stránkach.

export async function loadLandingMessages() {
  const messages = await import("../messages/en/landing.json");
  return messages.default as {
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    /**
     * Tri heslá v hero (nadpis + veta). Nepovinné: bez nich komponent vykreslí
     * hero s `heroTitle`/`heroSubtitle`, ktorý nesie aj titulok stránky.
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

// Návod (stránka /navod) berie texty odtiaľto ako landing, nie z appkového
// next-intl — je to verejná časť webu popri landingu.
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

export async function loadNavodMessages(): Promise<NavodMessages> {
  const messages = await import("../messages/en/navod.json");
  return messages.default as NavodMessages;
}

// Krátky návod pre pripojeného hráča/rodiča/manažéra (/navod-hrac) — rovnaká
// štruktúra ako trénerský návod.
export async function loadNavodHracMessages(): Promise<NavodMessages> {
  const messages = await import("../messages/en/navod-hrac.json");
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

export async function loadCennikHracMessages(): Promise<CennikHracMessages> {
  const messages = await import("../messages/en/cennik-hrac.json");
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

export async function loadLandingHracMessages(): Promise<LandingHracMessages> {
  const messages = await import("../messages/en/landing-hrac.json");
  return messages.default as LandingHracMessages;
}

// Stránka pre federácie/kluby/akadémie (/federacie) — informačná, bez
// prihlásenia a bez registračného tlačidla; organizácia sa nezakladá
// samoobslužne (docs/onboarding-organizacie.md).
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
  pricingContact: string;
  footerTagline: string;
};

/**
 * Stránka je po anglicky ako celý verejný web. Cestu sem má za sebou: do
 * 2026-08-31 bola LEN slovenská (s odôvodnením, že prvými B2B zákazníkmi sú
 * slovenské zväzy — **nepodložený predpoklad, nie rozhodnutie usera**), potom
 * SK/EN, a od 2026-09-14 je jednojazyčná ako ostatné stránky. Federačný produkt
 * sa ponúka aj mimo Slovenska a obchodná korešpondencia nie je vec stránky.
 */
export async function loadFederacieMessages(): Promise<FederacieMessages> {
  const messages = await import("../messages/en/federacie.json");
  return messages.default as FederacieMessages;
}

// Rozcestník na plaw.online (verejná tvár): **troje dvere** — tréner na
// plaw.win, sledujúci (hráč, rodič, manažér) na plaw.click a federačná
// stránka. Tretie dvere pribudli 2026-08-22 spolu s doménou plaw.click:
// dovtedy viedli prvé dvere „tréner, hráč, rodič, manažér" všetkých na
// trénerský marketing, čo pre sledujúceho nikdy nesedelo.

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

export async function loadRozcestnikMessages(): Promise<RozcestnikMessages> {
  const messages = await import("../messages/en/rozcestnik.json");
  return messages.default as RozcestnikMessages;
}
