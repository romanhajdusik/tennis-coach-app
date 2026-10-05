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

import type { DisciplineId } from "@/lib/disciplines/types";

export type BillingInterval = "month" | "year";

export const BILLING_INTERVALS: readonly BillingInterval[] = ["month", "year"];

/**
 * Produkt trénerskej hladiny. `players` = koľko hráčov naraz aktívnych.
 *
 * **Každá disciplína má vlastné produkty** (rozhodnuté 2026-08-16, docs
 * `cennik-navrh.md` §6 bod 2; zavedené 2026-10-02) s rovnakými cenami — aby
 * bolo v Stripe vidno, koľko zarobila ktorá appka, a aby zákazník v pokladni
 * videl, za čo platí. Disciplína je povinná, rovnako ako všade inde.
 *
 * **Tenis si necháva ID bez prefixu** (`plaw_coach_3`): tak vznikol pred
 * spustením a viažu sa naň ostré predplatné. ID produktu sa v Stripe nedá
 * zmeniť, názov áno.
 */
export function coachProductId(players: number, discipline: DisciplineId) {
  return discipline === "tennis"
    ? `plaw_coach_${players}`
    : `plaw_${discipline}_coach_${players}`;
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
 *
 * Overuje sa proti hladinám TEJ disciplíny, v ktorej appke tréner platí —
 * inak by si v kondičke kúpil tenisový produkt a v Stripe by sa tržby
 * pomiešali.
 */
export function isKnownCoachLookupKey(
  value: string,
  players: readonly number[],
  discipline: DisciplineId,
) {
  return players.some((count) =>
    BILLING_INTERVALS.some(
      (interval) =>
        priceLookupKey(coachProductId(count, discipline), interval) === value,
    ),
  );
}

/**
 * Disciplíny, ktoré majú v Stripe vlastné trénerské produkty. Číta to webhook
 * (`playerLimitOfLookupKey`), skript, ktorý produkty zakladá, aj sada
 * `stripe.js` — šport, ktorý tu chýba, by v pokladni síce zaplatil, ale
 * zmenu plánu v portáli by mu webhook nezapísal.
 *
 * Padel, bedminton a pickleball majú od 2026-10-05 **rovnaké ceny** ako tenis
 * a kondička (rozhodol user, docs `roadmap-buduce-smery.md` §1.1 otázka č. 3).
 */
export const SOLD_DISCIPLINES: readonly DisciplineId[] = [
  "tennis",
  "padel",
  "badminton",
  "pickleball",
  "fitness",
];

/**
 * Koľko hráčov patrí k cene s týmto `lookup_key` — alebo `null`, keď to nie
 * je trénerská cena (sledujúci, neznámy kľúč).
 *
 * **Prečo to webhook potrebuje (oprava 2026-10-03):** pri zmene plánu
 * v zákazníckom portáli Stripe vymení CENU predplatného, ale jeho METADÁTA
 * nechá tak, ako ich zapísala pokladňa. Hladina čítaná z metadát by tak
 * ostala pôvodná — tréner by platil za 6 hráčov a appka by mu dovolila 3
 * (alebo naopak). Rozhoduje preto cena, ktorá sa naozaj platí.
 *
 * Kľúč sa neparsuje regulárnym výrazom, ale porovná so všetkými známymi —
 * rovnaká zásada ako pri `isKnownCoachLookupKey`.
 */
export function playerLimitOfLookupKey(
  value: string,
  players: readonly number[],
): number | null {
  for (const discipline of SOLD_DISCIPLINES) {
    for (const count of players) {
      if (isKnownCoachLookupKey(value, [count], discipline)) return count;
    }
  }
  return null;
}

/**
 * Smie pokladňa prijať tento kľúč ako cenu pre SLEDUJÚCEHO?
 *
 * Rovnaký dôvod ako pri trénerských hladinách: prehliadač posiela `lookup_key`
 * a bez tohto zoznamu by si ktokoľvek poslal ľubovoľný kľúč z účtu — napríklad
 * trénerský, ktorý je lacnejší za viac obsahu.
 */
export function isFollowerLookupKey(value: string) {
  return BILLING_INTERVALS.some(
    (interval) => priceLookupKey(FOLLOWER_PRODUCT_ID, interval) === value,
  );
}
