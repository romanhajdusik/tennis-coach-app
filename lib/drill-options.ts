export const CATEGORY_OPTIONS = [
  "Forhand",
  "Backhand",
  "Volley",
  "Return",
  "Servis",
  "Herné cvičenia",
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
  Servis: ["SR1-DCE", "SR1-ADV", "SR2-DCE", "SR2-ADV"],
  "Herné cvičenia": [
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
// do "Ostatné") a umožňujú prepnutie grafu na stĺpce. Ostatné zamerania
// (Return, Servis, Herné cvičenia, POINTS) sa nastavia samostatne neskôr.
export const ANALYTICS_FULL_BREAKDOWN_CATEGORIES = ["Forhand", "Backhand", "Volley"];
