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

  label: "Fitness",

  domain: "fitness.plawsports.com",

  // Posledné dve zamerania majú PEVNÝ názov rovnako ako ostatné — tréner si
  // do nich dá vlastné cvičenia, ale zameranie sa nepremenúva (premenovateľné
  // zameranie by muselo byť dáta, nie konfigurácia).
  //
  // Vznikli ako rezervné sloty „YOUR 1"/„YOUR 2"; **2026-08-22 dostali podľa
  // návrhu testerov konkrétny názov** (migrácia
  // `20260822090000_rename_fitness_reserve_categories`), lebo sa im v praxi
  // zapĺňali práve rozcvičkou a regeneráciou.
  //
  // **V názve je spojovník, NIE lomka** — zameranie ide do adresy analytiky
  // (`/analytics/[category]`), kde by lomka skončila ako `%2F` a rozbila
  // segment routy.
  categories: [
    "ENDURANCE",
    "STRENGTH",
    "SPEED",
    "FOOTWORK",
    "COORDINATION",
    "MOBILITY",
    "CORE MUSCLES",
    "STRETCHING",
    "WARM UP - COOL DOWN",
    "REGENERATION",
  ],

  defaultCategory: "ENDURANCE",

  // Kondička nemá predvolené kódy — tréner si všetkých 20 slotov na zameranie
  // pomenuje sám na `/drill-codes`. Prázdny zoznam znamená 20 prázdnych slotov.
  drills: {},

  // Oproti tenisu (5–30) pribudlo 60 — kondičná jednotka býva dlhší blok.
  durations: [5, 10, 15, 20, 30, 60],

  // Charakter úderu (offensive/neutral/defensive) je tenisový slovník.
  character: null,

  // Kondičný tréner je VLASTNÍK dát, takže kód vydáva on — rovnaký smer ako
  // pri zdieľaní s rodičom. Kód je viazaný na kartu, nie na účet, takže tréner
  // s dvadsiatimi hráčmi vydá dvadsať kódov a každý tenisový kolega dostane
  // prístup len k svojmu dieťaťu.
  cardLink: "owner",

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
      "WARM UP - COOL DOWN",
      "REGENERATION",
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
