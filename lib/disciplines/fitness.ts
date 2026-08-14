import type { DisciplineConfig } from "@/lib/disciplines/types";

/**
 * Kondičný tréning — jedna spoločná disciplína pre všetky raketové športy
 * (rozhodnuté 2026-08-12): kondiční tréneri v nich pracujú naprieč športmi
 * a zamerania aj cvičenia sú identické, takže kondička nemá varianty podľa
 * športu ani vlastný SportConfig. Beží na `fitness.plawsports.com`.
 *
 * Zadanie od používateľa (docs/roadmap-buduce-smery.md §2.1):
 * 10 zameraní × 20 slotov na kódy cvičení, trvanie 5–60 minút,
 * charakter cvičenia sa NEZAZNAMENÁVA a v analytike je len čas a %.
 */
export const FITNESS_DISCIPLINE: DisciplineConfig = {
  id: "fitness",

  domain: "fitness.plawsports.com",

  // Posledné dve sú rezervné zamerania s PEVNÝM názvom — tréner si do nich
  // dá vlastné cvičenia, ale zameranie sa nepremenúva (premenovateľné
  // zamerania by museli byť dáta, nie konfigurácia).
  categories: [
    "ENDURANCE",
    "STRENGTH",
    "SPEED",
    "FOOTWORK",
    "COORDINATION",
    "MOBILITY",
    "CORE MUSCLES",
    "STRETCHING",
    "YOUR 1",
    "YOUR 2",
  ],

  defaultCategory: "ENDURANCE",

  // Kondička nemá predvolené kódy — tréner si všetkých 20 slotov na zameranie
  // pomenuje sám na `/drill-codes`. Prázdny zoznam znamená 20 prázdnych slotov.
  drills: {},

  // Oproti tenisu (5–30) pribudlo 60 — kondičná jednotka býva dlhší blok.
  durations: [5, 10, 15, 20, 30, 60],

  // Charakter úderu (offensive/neutral/defensive) je tenisový slovník.
  character: null,

  analytics: {
    // Každé zameranie ukáže úplný rozpad svojich kódov + prepínač grafu;
    // kondička nemá dôvod nič zbaľovať do "Ostatné".
    fullBreakdownCategories: [
      "ENDURANCE",
      "STRENGTH",
      "SPEED",
      "FOOTWORK",
      "COORDINATION",
      "MOBILITY",
      "CORE MUSCLES",
      "STRETCHING",
      "YOUR 1",
      "YOUR 2",
    ],

    // Prefixové skupiny sú tenisová vec (1st/2nd serve, forehand/backhand
    // return) — kondičné kódy si tréner pomenúva voľne.
    groupedCategories: {},

    // Odhad úderov kondička nepočíta vôbec: v analytike je len čas a %.
    strokes: null,

    // Desať zameraní by v koláči potrebovalo desať odlíšiteľných farieb —
    // toľko ich paleta nemá a mať nemôže. Identitu preto nesie popis vedľa
    // stĺpca, nie farba.
    shareChart: "bars",
  },
};
