import { cache } from "react";
import { getOrgMembership } from "@/lib/org/membership";
import type { DisciplineConfig, DisciplineId } from "@/lib/disciplines/types";
import {
  DISCIPLINES,
  getDeploymentDiscipline,
} from "@/lib/disciplines/registry";

export {
  disciplineConfig,
  getDeploymentDiscipline,
  isDisciplineId,
} from "@/lib/disciplines/registry";

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

// Zoznam disciplín a disciplína nasadenia žijú v `lib/disciplines/registry.ts`
// (bez serverových závislostí, číta ich aj `proxy.ts`); tu sú re-exportované.

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

/**
 * Má sa v tomto zameraní zobraziť odhad počtu úderov? Nie, ak ho disciplína
 * nepočíta vôbec (kondička = len čas a %), alebo ak je v ňom nevýpovedný
 * (tenisové POINTS = zápasové body).
 *
 * Verzia s explicitnou konfiguráciou je pre pult: šéftréner si prezerá aj
 * disciplínu, ktorú sám „nerobí", takže sa nesmie pýtať tej svojej.
 */
export function showsStrokesIn(
  config: DisciplineConfig,
  category: string,
): boolean {
  const { strokes } = config.analytics;
  return Boolean(strokes && !strokes.hiddenCategories.includes(category));
}

export async function showsStrokes(category: string): Promise<boolean> {
  return showsStrokesIn(await getDisciplineConfig(), category);
}

export type { DisciplineConfig, DisciplineId };
