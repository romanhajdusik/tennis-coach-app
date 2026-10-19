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

/** Počet slotov v jednom stĺpci — sloty sa delia medzi stĺpce rovnakým dielom. */
function columnSize(slotCount: number, groups: AnalyticsCodeGroup[]) {
  return Math.floor(slotCount / groups.length);
}

/**
 * Stĺpce na `/drill-codes` podľa POZÍCIE (od 2026-10-19): stĺpec `i` sú sloty
 * `[i*n, (i+1)*n)`. Dovtedy sa delilo podľa textu kódu (`splitSlotsIntoGroups`)
 * a kód napísaný do stĺpca bez jeho prefixu po uložení „odskočil" inam —
 * nahlásil to zákazník pri Return. Tréner má kód nájsť presne tam, kam ho
 * napísal; prefix mu pri ukladaní doplní `withColumnPrefixes`.
 *
 * Výnimka je starší tvar dát — predvolené kódy (osem returnov v slotoch 1–8)
 * a čokoľvek, kde by pozičné delenie dalo kód s prefixom INÉHO stĺpca. Taký
 * stav sa ukáže po starom, podľa textu; formulár odosiela stĺpce za sebou,
 * takže po prvom uložení sú dáta už pozičné.
 */
export function slotsToColumns(
  slots: string[],
  groups: AnalyticsCodeGroup[],
): string[][] {
  const size = columnSize(slots.length, groups);
  const positional = groups.map((_, index) =>
    slots.slice(index * size, (index + 1) * size),
  );

  const misplaced = positional.some((column, index) =>
    column.some((value) => {
      const owner = groups.findIndex((group) => value.startsWith(group.prefix));
      return owner >= 0 && owner !== index;
    }),
  );

  return misplaced ? splitSlotsIntoGroups(slots, groups) : positional;
}

/**
 * Doplní kódu prefix stĺpca, do ktorého ho tréner napísal — o forehande či
 * backhande rozhoduje stĺpec, nie to, či si tréner pamätá `RET-FRH`
 * (rozhodol user 2026-10-19). Analytika zoskupuje podľa textu kódu, takže
 * bez prefixu by kód skončil v „Ostatné".
 *
 * - kód už začína prefixom svojho stĺpca → nechá sa (prefix sa zjednotí na
 *   veľké písmená),
 * - začína prefixom INÉHO stĺpca → prefix sa vymení, stĺpec má prednosť,
 * - inak sa pridá `<prefix>-` pred kód.
 *
 * `codes` sú hodnoty v poradí formulára, teda stĺpec za stĺpcom.
 */
export function withColumnPrefixes(
  codes: string[],
  groups: AnalyticsCodeGroup[],
  slotCount: number,
): string[] {
  const size = columnSize(slotCount, groups);

  return codes.map((code, index) => {
    if (!code) return code;
    const own = groups[Math.min(Math.floor(index / size), groups.length - 1)];
    const upper = code.toUpperCase();

    if (upper.startsWith(own.prefix.toUpperCase())) {
      return own.prefix + code.slice(own.prefix.length);
    }

    const other = groups.find((group) =>
      upper.startsWith(group.prefix.toUpperCase()),
    );
    if (other) {
      return own.prefix + code.slice(other.prefix.length);
    }

    return `${own.prefix}-${code}`;
  });
}
