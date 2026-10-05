import type { DisciplineConfig, DisciplineId } from "@/lib/disciplines/types";
import { TENNIS_DISCIPLINE } from "@/lib/disciplines/tennis";
import { FITNESS_DISCIPLINE } from "@/lib/disciplines/fitness";
import { PADEL_DISCIPLINE } from "@/lib/disciplines/padel";
import { BADMINTON_DISCIPLINE } from "@/lib/disciplines/badminton";
import { PICKLEBALL_DISCIPLINE } from "@/lib/disciplines/pickleball";

/**
 * Zoznam disciplín a disciplína NASADENIA — bez akejkoľvek serverovej
 * závislosti (žiadne `next/headers`, Supabase ani `react` cache), aby ho
 * mohla čítať aj `proxy.ts` a klientske komponenty. Disciplínu PRIHLÁSENÉHO
 * (členstvo vo federácii) vie len `lib/discipline.ts`, ktorý odtiaľto
 * re-exportuje.
 */
export const DISCIPLINES: Record<DisciplineId, DisciplineConfig> = {
  // Poradie: športy na kurte, kondička posledná.
  tennis: TENNIS_DISCIPLINE,
  padel: PADEL_DISCIPLINE,
  badminton: BADMINTON_DISCIPLINE,
  pickleball: PICKLEBALL_DISCIPLINE,
  fitness: FITNESS_DISCIPLINE,
};

/** Všetky disciplíny v poradí konfigurácie (kurtové prvé, kondička posledná). */
export const DISCIPLINE_IDS = Object.keys(DISCIPLINES) as DisciplineId[];

/**
 * Kondička — jediná disciplína druhu `fitness`, spoločná pre všetky raketové
 * športy. Pomenovaná konštanta namiesto reťazca rozsypaného po kóde.
 */
export const FITNESS_DISCIPLINE_ID: DisciplineId = "fitness";

/**
 * Predvolený šport na kurte: tam, kde chýba alebo je neznámy (prod beží bez
 * premennej, stará organizácia bez `sport`), je to tenis — pôvodná appka.
 */
const DEFAULT_COURT_DISCIPLINE: DisciplineId = "tennis";

/**
 * Disciplína NASADENIA. `NEXT_PUBLIC_*`, lebo ju pri builde treba vložiť do
 * balíka; musí sa čítať týmto celým zápisom, dynamický prístup sa nevloží.
 *
 * Neznáma alebo chýbajúca hodnota = tenis: `plaw.win` beží v produkcii bez
 * tejto premennej a nesmie sa zmeniť tým, že ju niekto zabudne nastaviť.
 */
export function getDeploymentDiscipline(): DisciplineId {
  const value = process.env.NEXT_PUBLIC_PLAW_DISCIPLINE;
  return isDisciplineId(value) ? value : DEFAULT_COURT_DISCIPLINE;
}

/** Je disciplína šport na kurte (nie kondička)? */
export function isCourtDiscipline(id: DisciplineId): boolean {
  return DISCIPLINES[id].kind === "court";
}

/**
 * Šport na kurte organizácie z `organizations.sport`. Zväz je vždy jeden šport
 * (rozhodnuté pri stavbe federácií) — jeho pult a pozvánky preto ponúkajú
 * práve **tento šport + kondičku**, nikdy iný šport (user 2026-10-05).
 * Neznáma hodnota = tenis.
 */
export function orgCourtDiscipline(sport: string | null | undefined): DisciplineId {
  return isDisciplineId(sport) && isCourtDiscipline(sport)
    ? sport
    : DEFAULT_COURT_DISCIPLINE;
}

/**
 * Disciplíny, ktoré dáva zmysel ponúknuť v organizácii: jej šport a kondička,
 * v tomto poradí (kurt je hlavná os federácie).
 */
export function orgDisciplines(courtDiscipline: DisciplineId): DisciplineId[] {
  return [courtDiscipline, FITNESS_DISCIPLINE_ID];
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
