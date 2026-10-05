import type { DisciplineConfig, DisciplineId } from "@/lib/disciplines/types";
import { TENNIS_DISCIPLINE } from "@/lib/disciplines/tennis";

/**
 * Dočasná kostra nového športu na kurte (docs/roadmap-buduce-smery.md §1.1,
 * krok 3). Rozhodnutia usera z 2026-10-05:
 *
 * - **9 zameraní s dočasným názvom** `FOCUS 1`…`FOCUS 9` — presné názvy user
 *   ešte nevie. Premenujú sa migráciou ako kondičkové `YOUR 1`/`YOUR 2`
 *   (`20260822090000`), vrátane `drill_codes`, `session_drills` a rodičovských
 *   kópií, a zároveň CHECK `drill_codes_category_check`.
 * - **Charakter cvičenia ÁNO** — rovnaký slovník ako tenis.
 * - **Odhad úderov zatiaľ NIE** (`strokes: null`) — sadzby user ešte nevie;
 *   doplnia sa sem bez migrácie.
 * - Pri 9 zameraniach je generálny graf **stĺpcový** — koláč paleta neunesie.
 *
 * Keď šport dostane skutočný obsah, jeho súbor prestane túto kostru používať
 * a bude mať vlastnú konfiguráciu ako `tennis.ts`.
 */
export const PLACEHOLDER_CATEGORIES = Array.from(
  { length: 9 },
  (_, index) => `FOCUS ${index + 1}`,
);

export function placeholderCourtSport({
  id,
  label,
  domain,
}: {
  id: DisciplineId;
  label: string;
  domain: string;
}): DisciplineConfig {
  return {
    id,
    kind: "court",
    label,
    domain,
    // Úvodnú obrazovku (vlastná fotka) alebo landing rozhodne krok 5 —
    // dovtedy návštevník na `/` skončí na prihlásení.
    intro: null,
    categories: PLACEHOLDER_CATEGORIES,
    defaultCategory: PLACEHOLDER_CATEGORIES[0],
    // Bez predvolených kódov — 20 prázdnych slotov, tréner si ich pomenuje.
    drills: {},
    durations: TENNIS_DISCIPLINE.durations,
    character: TENNIS_DISCIPLINE.character,
    // Šport na kurte kód ZADÁVA, kondička ho vydáva (rovnako ako tenis).
    cardLink: "viewer",
    analytics: {
      fullBreakdownCategories: PLACEHOLDER_CATEGORIES,
      groupedCategories: {},
      strokes: null,
      shareChart: "bars",
    },
  };
}
