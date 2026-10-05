// Ceny verejného webu na JEDNOM mieste. Rozhodnuté sú v `docs/cennik-navrh.md`
// (§3 trénerské hladiny, §8.2 hráč/rodič/manažér) — keď sa menia, mení sa
// TENTO súbor a Stripe, nikdy nie text stránky. Ten nesie len slová okolo
// čísel; sumy sa doň dostávajú odtiaľto už naformátované.
//
// POZOR: appka sama tieto čísla nikde nevynucuje — stráže čítajú
// `profiles.player_limit` a `subscription_status` (lib/subscription.ts).
// Tento súbor je marketing, nie zdroj pravdy pre paywall.

export type CoachTier = {
  /** Koľko hráčov smie mať tréner NARAZ AKTÍVNYCH (archivovaní sa nerátajú). */
  players: number;
  monthly: number;
  yearly: number;
  /** Zvýraznená dlaždica v cenníku (stredná hladina). */
  featured?: boolean;
};

// Ročná cena = mesačná × 12 − 40 %, zaokrúhlená nahor na deväťdesiatku
// (49,68 → 49,90; 92,88 → 92,90; 179,28 → 179,90).
export const COACH_TIERS: readonly CoachTier[] = [
  { players: 3, monthly: 6.9, yearly: 49.9 },
  { players: 6, monthly: 12.9, yearly: 92.9, featured: true },
  { players: 12, monthly: 24.9, yearly: 179.9 },
];

// Hráč / rodič / manažér sleduje vždy JEDNÉHO hráča.
//
// Od 2026-09-29 platí aj tu pravidlo −40 % (6,90 × 12 − 40 % = 49,68 → 49,90),
// takže cenník už nemá výnimku a ročná zľava je na celom webe rovnaká.
// Predtým to bolo 5,90/36 € — 36 € držalo vetu „pod 10 centov na deň".
// Tú vetu tým používateľ vedome obetoval (rozhodol 2026-09-29): denná suma je
// teraz 13,7 centa a text ju dopočítava sám, takže nikde neostalo staré číslo.
// Suma je zhodná s najnižšou trénerskou hladinou (3 hráči) — je to zámer.
export const FOLLOWER_PRICE = { monthly: 6.9, yearly: 49.9 } as const;

// Hráčsky denník — hráč si zapisuje sám (docs/roadmap-buduce-smery.md §6).
// Rovnaká suma ako sledujúci (rozhodol user 2026-10-05, §6.5 otázka č. 2),
// preto odkaz, nie druhé číslo, ktoré by sa raz rozišlo.
export const SELF_DIARY_PRICE = FOLLOWER_PRICE;

// Verejný web je jednojazyčný (viď lib/landing-locale.ts), takže je formát
// pevne anglický — „€6.90", nie „6,90 €".
export function formatEur(amount: number) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Koľko centov denne stojí jeden hráč — dopočítava sa, zámerne sa neopisuje
 * z dokumentu. Inak by pri zmene ceny ostalo v texte staré číslo a nikto by
 * si toho nevšimol (je to najdrobnejší údaj na celej stránke).
 */
export function centsPerPlayerDay(annualTotal: number, players: number) {
  return formatDecimal((annualTotal / 365 / players) * 100);
}

/**
 * Dlaždice trénerského cenníka, naformátované pre `LandingPricing`. Volá ju
 * tenisový aj kondičný landing — sumy sú rovnaké (docs `cennik-navrh.md`
 * §6 bod 2), takže výpočet má byť tiež jeden. `playerCounts` sú štítky
 * z textov stránky („3 active players"), lebo pluralita je vec jazyka.
 */
export function coachTierViews(playerCounts: readonly string[]) {
  return COACH_TIERS.map((tier, index) => ({
    players: playerCounts[index],
    monthly: formatEur(tier.monthly),
    yearly: formatEur(tier.yearly),
    yearlyPerMonth: formatEur(tier.yearly / 12),
    monthlyYearTotal: formatEur(tier.monthly * 12),
    centsMonthly: centsPerPlayerDay(tier.monthly * 12, tier.players),
    centsYearly: centsPerPlayerDay(tier.yearly, tier.players),
    featured: tier.featured === true,
  }));
}
