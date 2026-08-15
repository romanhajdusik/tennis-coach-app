import { cache } from "react";
import { getOrgMembership } from "@/lib/org/membership";
import type { DisciplineConfig, DisciplineId } from "@/lib/disciplines/types";
import { TENNIS_DISCIPLINE } from "@/lib/disciplines/tennis";
import { FITNESS_DISCIPLINE } from "@/lib/disciplines/fitness";

/**
 * JEDINÝ ZDROJ PRAVDY o tom, ktorú disciplínu appka práve obsluhuje —
 * rovnaký princíp ako `getSelectedPlayer()` pri vybranom hráčovi. Nikdy
 * neodvodzuj disciplínu inde (zo športu hráča, z trénera ani z hostname):
 *
 * - zo ŠPORTU HRÁČA nie, lebo kondičný tréner má v jednom rosteri tenistu
 *   aj bedmintonistu,
 * - z TRÉNERA nie, lebo `assign_player_to_coach` prepisuje `coach_id` aj na
 *   starých tréningoch, takže by preradenie hráča spätne premenilo tenisové
 *   tréningy na kondičné,
 * - z HOSTNAME nie, lebo vo federácii chodia tenisový aj kondičný tréner na
 *   tú istú org subdoménu.
 *
 * Disciplína má preto DVA zdroje podľa toho, kde appka beží:
 *
 * 1. **Samostatný režim** (`plaw.win`, `fitness.plawsports.com`) — vec
 *    NASADENIA. Jedno nasadenie = jedna disciplína.
 * 2. **Federácia** (`<slug>.plaw.win`) — vlastnosť ČLENSTVA prihláseného
 *    trénera (`organization_members.discipline`, docs §2.2). Adresa o nej
 *    nehovorí nič, obaja tréneri chodia na tú istú subdoménu.
 *
 * Na tréningu sa aj tak ukladá ako štítok (`sessions.discipline`), aby sa dala
 * prečítať aj tam, kde ani jeden z týchto zdrojov nič nehovorí.
 */

const DISCIPLINES: Record<DisciplineId, DisciplineConfig> = {
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

/**
 * Disciplína prihláseného. Vo federácii ju určuje ČLENSTVO, mimo nej nasadenie.
 *
 * Rozhoduje členstvo, nie subdoména: RLS sa pýta rovnako (`current_org_id()`
 * číta `organization_members`), takže by sa appka a databáza inak mohli
 * rozísť — a hlavičky od proxy navyše v každom rendri k dispozícii nie sú.
 *
 * Odhlásený a šéftréner (ten žiadnu disciplínu „nerobí", vidí obe) dostanú
 * disciplínu nasadenia, teda na org subdoméne tenis.
 */
export const getDiscipline = cache(async (): Promise<DisciplineId> => {
  const membership = await getOrgMembership();

  if (!membership || membership.role === "director") {
    return getDeploymentDiscipline();
  }

  return membership.discipline;
});

export const getDisciplineConfig = cache(
  async (): Promise<DisciplineConfig> => DISCIPLINES[await getDiscipline()],
);

/** Konfigurácia konkrétnej disciplíny — pre riadky s vlastným štítkom. */
export function disciplineConfig(id: DisciplineId): DisciplineConfig {
  return DISCIPLINES[id];
}

/**
 * Má sa v tomto zameraní zobraziť odhad počtu úderov? Nie, ak ho disciplína
 * nepočíta vôbec (kondička = len čas a %), alebo ak je v ňom nevýpovedný
 * (tenisové POINTS = zápasové body).
 */
export async function showsStrokes(category: string): Promise<boolean> {
  const { strokes } = (await getDisciplineConfig()).analytics;
  return Boolean(strokes && !strokes.hiddenCategories.includes(category));
}

export type { DisciplineConfig, DisciplineId };
