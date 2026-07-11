export const CATEGORY_OPTIONS = [
  "Forhand",
  "Backhand",
  "Volley",
  "Return",
  "Serve",
  "GAME DRILLS",
  "POINTS",
];

export const CHARACTER_OPTIONS = [
  { value: "offensive", label: "Offensive" },
  { value: "neutral", label: "Neutral" },
  { value: "defensive", label: "Defensive" },
];

export const CHARACTER_LABELS: Record<string, string> = {
  offensive: "Offensive",
  neutral: "Neutral",
  defensive: "Defensive",
};

export const DURATION_OPTIONS = [5, 10, 15, 20, 30];

// Kódy cvičení podľa kategórie — kategória bez zoznamu (žiadna zatiaľ)
// by použila voľné textové pole
export const DRILLS: Record<string, string[]> = {
  Forhand: ["FRH-CRS", "FRH-DTL", "FRH-IOU", "FRH-IIN", "FRH-SLC", "FRH-DRP"],
  Backhand: ["BKH-CRS", "BKH-DTL", "BKH-IOU", "BKH-IIN", "BKH-SLC", "BKH-DRP"],
  Volley: [
    "VOL-FRH",
    "VOL-BKH",
    "VOL-FRH-LOW",
    "VOL-FRH-HGH",
    "VOL-FRH-DRP",
    "VOL-FRH-DRV",
    "VOL-BKH-LOW",
    "VOL-BKH-HGH",
    "VOL-BKH-DRP",
    "VOL-BKH-DRV",
  ],
  Return: [
    "RET-FRH-CRS",
    "RET-FRH-DTL",
    "RET-FRH-MID",
    "RET-FRH-BLC",
    "RET-BKH-CRS",
    "RET-BKH-DTL",
    "RET-BKH-MID",
    "RET-BKH-BLC",
  ],
  Serve: ["SR1-DCE", "SR1-ADV", "SR2-DCE", "SR2-ADV"],
  "GAME DRILLS": [
    "RZH-TRE",
    "RZH-ZAP",
    "SR1+1",
    "SR2+1",
    "RET+1",
    "TRI-C+L",
    "TRI-CC+L",
    "TRI-C+LL",
    "TRI-CC+LL",
    "DR8-C+L",
    "DR8-CCL+CC",
    "FRH-ATK+VOL",
    "BKH-ATK+VOL",
    "VOL-PRP+VOL",
    "ATK+VOL+SSH",
  ],
  POINTS: ["TRN-PRC", "HOM-PRC", "MATCH"],
};

export const DEFAULT_CATEGORY = CATEGORY_OPTIONS[0];
export const DEFAULT_CHARACTER = "neutral";

// Tieto zamerania zobrazujú v analytike vždy úplný rozpad (bez zbaľovania
// do "Ostatné") a umožňujú prepnutie grafu na stĺpce.
export const ANALYTICS_FULL_BREAKDOWN_CATEGORIES = [
  "Forhand",
  "Backhand",
  "Volley",
  "GAME DRILLS",
];

// Tieto zamerania nemajú rozpad podľa kódu ani charakteru — v analytike sa
// zobrazí jediný graf: celkový odohraný čas za obdobie.
export const ANALYTICS_TOTAL_TIME_ONLY_CATEGORIES = ["POINTS"];

export type AnalyticsCodeGroup = { label: string; prefix: string };

// Tieto zamerania majú v analytike dvojúrovňové zobrazenie podľa kódu
// cvičenia: hlavný stĺpcový graf rozdelí kódy do dvoch skupín podľa
// prefixu (priradenie je podľa textu kódu, nie podľa slotu — ak si tréner
// kód premenuje mimo tento prefix, spadne do skupiny "Ostatné"), klik na
// stĺpec zobrazí detail jednotlivých kódov v rámci vybranej skupiny.
export const ANALYTICS_GROUPED_CATEGORIES: Record<string, AnalyticsCodeGroup[]> = {
  Return: [
    { label: "Forhand return", prefix: "RET-FRH" },
    { label: "Backhand return", prefix: "RET-BKH" },
  ],
  Serve: [
    { label: "1st serve", prefix: "SR1" },
    { label: "2nd serve", prefix: "SR2" },
  ],
};

// Rozdelí sloty kódov do stĺpcov podľa skutočného prefixu kódu (nie podľa
// pozície slotu) — kód RET-BKH-... patrí do stĺpca "Backhand return" bez
// ohľadu na to, v ktorom slote je uložený. Prázdne a nezhodné (napr. po
// premenovaní mimo konvenciu) sloty sa doplnia do menšieho stĺpca, aby
// súčet ostal rovnaký ako počet vstupných slotov.
export function splitSlotsIntoGroups(
  slots: string[],
  groups: AnalyticsCodeGroup[],
): string[][] {
  const buckets: string[][] = groups.map(() => []);
  const leftovers: string[] = [];

  for (const value of slots) {
    const groupIndex = value
      ? groups.findIndex((group) => value.startsWith(group.prefix))
      : -1;
    if (groupIndex >= 0) {
      buckets[groupIndex].push(value);
    } else {
      leftovers.push(value);
    }
  }

  for (const value of leftovers) {
    const smallestIndex = buckets.reduce(
      (minIndex, bucket, index) =>
        bucket.length < buckets[minIndex].length ? index : minIndex,
      0,
    );
    buckets[smallestIndex].push(value);
  }

  return buckets;
}
