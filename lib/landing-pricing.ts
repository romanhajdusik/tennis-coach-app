import type { LandingLocale } from "@/lib/landing-locale";

// Ceny verejného webu na JEDNOM mieste. Rozhodnuté sú v `docs/cennik-navrh.md`
// (§3 trénerské hladiny, §8.2 hráč/rodič/manažér) — keď sa menia, mení sa
// TENTO súbor a Stripe, nie deväť prekladov. Preklady nesú len text okolo
// čísel (štítky, pluralita, meny sa formátujú podľa jazyka).
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

// Hráč / rodič / manažér sleduje vždy JEDNÉHO hráča. Ročná cena je vedomá
// výnimka z pravidla −40 % (dala by 42,48 €) — 36 € drží vetu „pod 10 centov
// na deň", ktorá je na tejto stránke hlavným argumentom (docs §8.2).
export const FOLLOWER_PRICE = { monthly: 5.9, yearly: 36 } as const;

export function formatEur(locale: LandingLocale, amount: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDecimal(locale: LandingLocale, value: number) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Koľko centov denne stojí jeden hráč — dopočítava sa, zámerne sa neopisuje
 * z dokumentu. Inak by pri zmene ceny ostalo v texte staré číslo a nikto by
 * si toho nevšimol (je to najdrobnejší údaj na celej stránke).
 */
export function centsPerPlayerDay(
  locale: LandingLocale,
  annualTotal: number,
  players: number,
) {
  return formatDecimal(locale, (annualTotal / 365 / players) * 100);
}
