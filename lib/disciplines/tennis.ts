import type { DisciplineConfig } from "@/lib/disciplines/types";

/**
 * Tenis — pôvodná a doteraz jediná disciplína appky. Hodnoty sú prevzaté
 * 1:1 z pôvodného `lib/drill-options.ts` a `lib/actions/analytics.ts`;
 * pri presune do konfigurácie sa zámerne nič nemenilo.
 */
export const TENNIS_DISCIPLINE: DisciplineConfig = {
  id: "tennis",

  label: "Tennis",

  domain: "plaw.win",

  categories: [
    "Forehand",
    "Backhand",
    "Volley",
    "Return",
    "Serve",
    "GAME DRILLS",
    "POINTS",
  ],

  defaultCategory: "Forehand",

  // Kódy cvičení podľa zamerania — zameranie bez zoznamu by použilo
  // voľné textové pole.
  drills: {
    Forehand: ["FRH-CRS", "FRH-DTL", "FRH-IOU", "FRH-IIN", "FRH-SLC", "FRH-DRP"],
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
  },

  durations: [5, 10, 15, 20, 30],

  character: {
    options: [
      { value: "offensive", label: "Offensive" },
      { value: "neutral", label: "Neutral" },
      { value: "defensive", label: "Defensive" },
    ],
    labels: {
      offensive: "Offensive",
      neutral: "Neutral",
      defensive: "Defensive",
    },
    defaultValue: "neutral",
  },

  // Tenisový tréner kód ZADÁVA: kondičná príprava jeho zverenca patrí
  // kondičnému trénerovi, on ju len vidí v kalendári.
  cardLink: "viewer",

  analytics: {
    // Tieto zamerania zobrazujú vždy úplný rozpad (bez zbaľovania do
    // "Ostatné") a umožňujú prepnutie grafu na stĺpce.
    fullBreakdownCategories: [
      "Forehand",
      "Backhand",
      "Volley",
      "GAME DRILLS",
      "POINTS",
    ],

    // Dvojúrovňové zobrazenie podľa kódu cvičenia: hlavný stĺpcový graf
    // rozdelí kódy do dvoch skupín podľa prefixu (priradenie je podľa textu
    // kódu, nie podľa slotu — ak si tréner kód premenuje mimo tento prefix,
    // spadne do skupiny "Ostatné"), klik na stĺpec zobrazí detail kódov.
    groupedCategories: {
      Return: [
        { label: "Forehand return", prefix: "RET-FRH" },
        { label: "Backhand return", prefix: "RET-BKH" },
      ],
      Serve: [
        { label: "1st serve", prefix: "SR1" },
        { label: "2nd serve", prefix: "SR2" },
      ],
    },

    strokes: {
      breakFactor: 0.8, // 20 % z celkového času ide na prestávku
      perMinByCharacter: {
        offensive: 25,
        neutral: 23,
        defensive: 20,
      },
      // Return, Serve a GAME DRILLS majú vlastnú frekvenciu úderov odlišnú
      // od výmen z dna kurtu — počet úderov sa preto počíta z fixnej sadzby,
      // nie podľa charakteru cvičenia.
      fixedPerMinByCategory: {
        Return: 6,
        Serve: 6,
        "GAME DRILLS": 22,
      },
      // POINTS = zápasové body, odhad úderov je tam nevýpovedný.
      hiddenCategories: ["POINTS"],
    },

    // Sedem zameraní = sedem odlíšiteľných farieb, koláč teda unesie identitu.
    shareChart: "donut",
  },
};
