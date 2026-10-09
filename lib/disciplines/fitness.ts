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

  kind: "fitness",

  label: "Fitness",

  domain: "fitness.plawsports.com",

  // Kondička nemá marketing, ale od 2026-09-21 má úvodnú obrazovku s vlastnou
  // fotkou (rebrík a dva medicinbaly na kurte, vybral user z vygenerovaných
  // variantov). Vygenerovaná — výbava ani kurt nemajú značku.
  intro: { photo: "/hero/fitness-portrait.webp" },

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

  // Len UKÁŽKA pri prázdnych slotoch (od 2026-10-09). Zoznam dodal user —
  // sú to slová, ktoré si do slotov píše kondičný tréner v praxi (plné názvy,
  // nie skratky, preto bez `drillGlossary`). Opravené len preklepy.
  drillExamples: {
    ENDURANCE: [
      "Continuous training",
      "Fartlek training",
      "Interval LD training",
      "Interval ShD training",
      "Repetition TR",
      "Circular TR",
      "Running",
      "Biking",
      "Rowing",
      "Ski erg",
      "Blazepod",
      "Cone drills",
    ],
    STRENGTH: [
      "Upper body",
      "Lower body",
      "Circular TR",
      "Repetition method",
      "Static holding method",
      "Core muscles",
      "Medicine ball TR",
      "Hamstrings",
      "Quadriceps",
      "Calf",
      "Back",
      "Chest",
      "Legs",
      "Arms",
      "ABS",
      "Shoulder",
    ],
    SPEED: [
      "Acceleration 5-30m",
      "Flying sprints 20-40m",
      "Resisted sprints 5-15m",
      "Assisted sprints 10-30m",
      "Repeated sprints 40-80m",
      "Sprints on court",
      "Reflex drills",
      "CMJump",
      "Jump forward",
      "One leg jump",
      "Hurdles jump",
      "Blazepod",
      "Medicine ball throw",
      "Lateral sprints",
      "Forward/Backward",
      "Cone sprints",
      "Shuffle run short",
      "Spider run",
      "Line run variations",
      "Shuffle run long",
    ],
    FOOTWORK: [
      "Split-step variations",
      "Side-chase steps",
      "Cross over steps",
      "Adjustment steps",
      "Quick start and stop",
      "Development practices",
      "Ladder exercises",
      "Cone exercises",
      "Step block variations",
      "Line footwork",
    ],
    COORDINATION: [
      "Eye-hand coordination",
      "Eye-foot coordination",
      "Dynamic balance",
      "Static balance",
      "Special ability",
      "Rhythm ability",
      "Timing ability",
      "Differentiation ability",
      "Blazepod",
      "Medicine ball throw",
      "Side-side jumps",
      "Side-forward jumps",
    ],
    MOBILITY: [
      "Shoulder",
      "Scapula",
      "Spine rotation",
      "Hips",
      "Pelvis",
      "Ankle mobility",
      "Wrist/forearm",
      "Sole",
      "Whole body",
    ],
    "CORE MUSCLES": [
      "Anti-rotation",
      "Anti-flexion",
      "Anti-extension",
      "Lateral flexion",
      "Dynamic rotation",
    ],
    STRETCHING: [
      "Treatment",
      "Shoulder",
      "Back muscles",
      "Chest muscle",
      "Forearm/wrist",
      "Hip flexors",
      "Hamstrings",
      "Quadriceps",
      "Glutes",
      "Hip rotation",
      "Calf",
      "Soleus",
      "Upper body",
      "Lower body",
      "Whole body",
    ],
    "WARM UP - COOL DOWN": [
      "Massage",
      "Treatment",
      "Boots",
      "Ice bath",
      "Swimming",
      "Biking",
      "Practice warm up",
      "Practice cool down",
      "Match warm up",
      "Match cool down",
    ],
    REGENERATION: ["Mental games"],
  },

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
