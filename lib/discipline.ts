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
 * Disciplína je preto vec NASADENIA: jedno nasadenie = jedna disciplína
 * (`fitness.plawsports.com` vs `plaw.win`), a na tréningu sa ukladá ako
 * štítok, aby sa dala prečítať aj tam, kde nasadenie nič nehovorí.
 *
 * Prečo funkcia a nie konštanta: keď raz bude jedno nasadenie obsluhovať
 * obe disciplíny naraz (kondička vo federácii — do v1 zámerne nejde),
 * pribudne sem argument s kontextom a volajúce miesta sa meniť nemusia.
 */

const DISCIPLINES: Record<DisciplineId, DisciplineConfig> = {
  tennis: TENNIS_DISCIPLINE,
  fitness: FITNESS_DISCIPLINE,
};

/**
 * `NEXT_PUBLIC_*`, lebo ponuky zameraní, trvaní a charakteru potrebujú aj
 * klientske komponenty (formulár cvičenia, grafy). Next ho pri builde vloží
 * do balíka natvrdo — čo je presne správne, keďže sa počas behu nasadenia
 * nemení. Musí sa čítať týmto celým zápisom, dynamický prístup sa nevloží.
 *
 * Neznáma alebo chýbajúca hodnota = tenis: `plaw.win` beží v produkcii bez
 * tejto premennej a nesmie sa zmeniť tým, že ju niekto zabudne nastaviť.
 */
export function getDiscipline(): DisciplineId {
  return process.env.NEXT_PUBLIC_PLAW_DISCIPLINE === "fitness"
    ? "fitness"
    : "tennis";
}

export function getDisciplineConfig(): DisciplineConfig {
  return DISCIPLINES[getDiscipline()];
}

/**
 * Má sa v tomto zameraní zobraziť odhad počtu úderov? Nie, ak ho disciplína
 * nepočíta vôbec (kondička = len čas a %), alebo ak je v ňom nevýpovedný
 * (tenisové POINTS = zápasové body).
 */
export function showsStrokes(category: string): boolean {
  const { strokes } = getDisciplineConfig().analytics;
  return Boolean(strokes && !strokes.hiddenCategories.includes(category));
}

export type { DisciplineConfig, DisciplineId };
