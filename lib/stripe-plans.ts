/**
 * Ako sa plány P.L.A.W volajú v Stripe — **jediné miesto, kde tie názvy žijú**.
 *
 * Číta to appka (pokladňa, neskôr webhook) aj `scripts/stripe/setup-products.js`,
 * ktorý produkty a ceny zakladá. Keby si každá strana skladala názov sama,
 * rozišli by sa pri prvom preklepe a pokladňa by hľadala cenu, ktorá
 * v Stripe neexistuje — čo sa prejaví až pri pokuse zaplatiť.
 *
 * **Sumy sem nepatria.** Tie majú vlastný zdroj pravdy v `lib/landing-pricing.ts`
 * (ten plní aj verejný web); tu je len identita plánu.
 */

export type BillingInterval = "month" | "year";

export const BILLING_INTERVALS: readonly BillingInterval[] = ["month", "year"];

/** Produkt trénerskej hladiny. `players` = koľko hráčov naraz aktívnych. */
export function coachProductId(players: number) {
  return `plaw_coach_${players}`;
}

/** Produkt pre sledujúceho (hráč, rodič, manažér) — vždy jeden hráč. */
export const FOLLOWER_PRODUCT_ID = "plaw_follower";

/**
 * `lookup_key` ceny. Cena v Stripe nemôže mať vlastné `id` (na rozdiel od
 * produktu), ale `lookup_key` je v rámci účtu unikátny — tak sa cena hľadá
 * a tak sa aj zaručí, že sa v testovacej a ostrej polovici volá rovnako.
 */
export function priceLookupKey(productId: string, interval: BillingInterval) {
  return `${productId}_${interval}ly`;
}

/**
 * Kľúče, ktoré smie pokladňa prijať od prehliadača. Bez tohto zoznamu by si
 * ktokoľvek poslal ľubovoľný `lookup_key` — vrátane cudzieho alebo takého,
 * ktorý raz v účte pribudne na inú vec.
 */
export function isKnownCoachLookupKey(value: string, players: readonly number[]) {
  return players.some((count) =>
    BILLING_INTERVALS.some(
      (interval) => priceLookupKey(coachProductId(count), interval) === value,
    ),
  );
}
