/**
 * Dátumová aritmetika kalendára — **v pásme toho, kto sa pozerá**.
 *
 * Prečo to nie je obyčajný `Date`: kalendár mieša dve veci, ktoré vyzerajú
 * rovnako, ale nie sú — *okamih* (kedy tréning začal) a *deň v kalendári*
 * (pod ktorý políčko patrí). `new Date(rok, mesiac, deň)` vytvorí polnoc
 * v pásme SERVERA, kým `format.dateTime` vykresľuje v pásme DIVÁKA. Kým sú
 * obe pásma rovnaké (lokálny vývoj), nič sa nedeje; na Verceli beží server
 * v UTC, takže divákovi západne od UTC sa popis rozišiel s mriežkou o deň —
 * mriežka Po 3 … Ne 9, ale nadpis „Aug 2 – Aug 8". To isté sa dialo aj
 * mesačnému nadpisu (1. august v pásme za UTC je ešte júl).
 *
 * Riešenie: dni sa počítajú ako **čisté kalendárne dátumy** (rok/mesiac/deň),
 * bez pásma, a do pásma sa prekladá len jedna vec — priradenie tréningu
 * (okamihu) ku dňu, cez `dayKeyIn`. Rovnaký princíp ako v
 * `lib/players/roster.ts`.
 */

/** Kalendárny deň bez času a bez pásma. `month` je 1–12. */
export type PlainDate = { year: number; month: number; day: number };

/**
 * Deň, do ktorého okamih patrí v danom pásme (`YYYY-MM-DD`). Locale `en-CA`
 * dáva ISO poradie, takže sa kľúče dajú porovnávať ako reťazce.
 */
export function dayKeyIn(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function plainDateKey(date: PlainDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

export function parsePlainDate(value: string | undefined): PlainDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  // Cez UTC, lebo `Date.UTC` neposúva pásmom — overí zároveň, že dátum
  // reálne existuje (31. februára by sa pretočil na marec).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Dnešok v pásme diváka. */
export function todayIn(timeZone: string, now: Date = new Date()): PlainDate {
  return parsePlainDate(dayKeyIn(timeZone, now))!;
}

export function addPlainDays(date: PlainDate, days: number): PlainDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Pondelok = 0 … nedeľa = 6. */
export function weekdayIndex(date: PlainDate): number {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return (utc.getUTCDay() + 6) % 7;
}

/** Pondelok týždňa, do ktorého dátum patrí. */
export function startOfWeek(date: PlainDate): PlainDate {
  return addPlainDays(date, -weekdayIndex(date));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * ISO 8601 týždeň — ten istý spôsob číslovania, aký používa analytika
 * (`Week {week}, {year}`), aby si tréner vedel týždeň v kalendári a v
 * analytike spárovať.
 *
 * Rok týždňa NIE JE vždy rok dátumu: týždeň patrí roku, do ktorého padne jeho
 * štvrtok. 1. januára 2021 (piatok) je preto 53. týždeň roku **2020**.
 * Počíta sa cez `Date.UTC`, takže do toho nevstupuje žiadne pásmo.
 */
export function isoWeek(date: PlainDate): { year: number; week: number } {
  const thursday = new Date(Date.UTC(date.year, date.month - 1, date.day));
  thursday.setUTCDate(thursday.getUTCDate() - weekdayIndex(date) + 3);

  const isoYear = thursday.getUTCFullYear();
  // 4. január leží vždy v prvom ISO týždni — jeho štvrtok je teda kotva.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3,
  );

  const week =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    );
  return { year: isoYear, week };
}

/**
 * `Date` na formátovanie NADPISOV. Formátovať sa musí s `timeZone: "UTC"`,
 * inak by ju next-intl preložil do pásma diváka a deň by opäť ušiel.
 */
export function plainToUtcDate(date: PlainDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

/** Nemenné voľby formátovania nadpisov — `timeZone` sa nesmie vynechať. */
export const LABEL_TIME_ZONE = "UTC" as const;
