import type { DisciplineConfig, DisciplineId } from "@/lib/disciplines/types";
import { TENNIS_DISCIPLINE } from "@/lib/disciplines/tennis";
import { FITNESS_DISCIPLINE } from "@/lib/disciplines/fitness";

/**
 * Zoznam disciplín a disciplína NASADENIA — bez akejkoľvek serverovej
 * závislosti (žiadne `next/headers`, Supabase ani `react` cache), aby ho
 * mohla čítať aj `proxy.ts` a klientske komponenty. Disciplínu PRIHLÁSENÉHO
 * (členstvo vo federácii) vie len `lib/discipline.ts`, ktorý odtiaľto
 * re-exportuje.
 */
export const DISCIPLINES: Record<DisciplineId, DisciplineConfig> = {
  tennis: TENNIS_DISCIPLINE,
  fitness: FITNESS_DISCIPLINE,
};

/**
 * Disciplína NASADENIA. `NEXT_PUBLIC_*`, lebo ju pri builde treba vložiť do
 * balíka; musí sa čítať týmto celým zápisom, dynamický prístup sa nevloží.
 *
 * Neznáma alebo chýbajúca hodnota = tenis: `plaw.win` beží v produkcii bez
 * tejto premennej a nesmie sa zmeniť tým, že ju niekto zabudne nastaviť.
 */
export function getDeploymentDiscipline(): DisciplineId {
  return process.env.NEXT_PUBLIC_PLAW_DISCIPLINE === "fitness"
    ? "fitness"
    : "tennis";
}

/** Konfigurácia konkrétnej disciplíny — pre riadky s vlastným štítkom. */
export function disciplineConfig(id: DisciplineId): DisciplineConfig {
  return DISCIPLINES[id];
}

/**
 * Je hodnota známa disciplína? Na overenie vstupu zvonka — adresy pultu
 * (`?discipline=`), viazaného argumentu `saveOrgDrillCodes` a odkazu
 * na prihlásení (`?account=`).
 *
 * **Disciplína sa NEODVODZUJE zo zamerania** (do 2026-10-05 to robila
 * `disciplineOfCategory()`): padel bude mať `Forehand` ako tenis, takže názov
 * zamerania disciplínu neurčuje. Kto analyzuje alebo ukladá disciplínu, ktorú
 * sám „nerobí" (šéftréner), ju dostáva výslovne — v adrese alebo v argumente
 * (docs/roadmap-buduce-smery.md §1.1).
 */
export function isDisciplineId(value: unknown): value is DisciplineId {
  return typeof value === "string" && Object.hasOwn(DISCIPLINES, value);
}
