import type { AnalyticsCodeGroup } from "@/lib/disciplines/types";

export type { AnalyticsCodeGroup };

/**
 * Zamerania, kódy cvičení, trvania a charakter sa presunuli do konfigurácie
 * disciplíny — čítaj ich cez `getDisciplineConfig()` z `@/lib/discipline`.
 * Tu zostáva len logika nad slotmi, ktorá je disciplínovo neutrálna.
 */

/**
 * Rozdelí sloty kódov do stĺpcov podľa skutočného prefixu kódu (nie podľa
 * pozície slotu) — kód RET-BKH-... patrí do stĺpca "Backhand return" bez
 * ohľadu na to, v ktorom slote je uložený. Prázdne a nezhodné (napr. po
 * premenovaní mimo konvenciu) sloty sa doplnia do menšieho stĺpca, aby
 * súčet ostal rovnaký ako počet vstupných slotov.
 */
export function splitSlotsIntoGroups(
  slots: string[],
  groups: AnalyticsCodeGroup[],
): string[][] {
  const buckets: string[][] = groups.map(() => []);
  const leftovers: string[] = [];

  for (const value of slots) {
    const groupIndex = value
      ? groups.findIndex((group) => value.startsWith(group.prefix))
      : -1;
    if (groupIndex >= 0) {
      buckets[groupIndex].push(value);
    } else {
      leftovers.push(value);
    }
  }

  for (const value of leftovers) {
    const smallestIndex = buckets.reduce(
      (minIndex, bucket, index) =>
        bucket.length < buckets[minIndex].length ? index : minIndex,
      0,
    );
    buckets[smallestIndex].push(value);
  }

  return buckets;
}
