import type { DisciplineConfig } from "@/lib/disciplines/types";

/**
 * Predvolené kódy jedného zamerania a čo znamenajú (od 2026-10-09).
 * `meaning` chýba, keď disciplína píše plné názvy namiesto skratiek
 * (kondička) — vtedy sa ukážu len názvy.
 */
export type DrillGuide = { code: string; meaning?: string }[];

/**
 * Zoznam „kód → čo znamená". Bez hookov, takže ho vie vykresliť appková
 * stránka s kódmi (klientsky formulár) aj verejný návod.
 */
export function DrillGlossaryList({ entries }: { entries: DrillGuide }) {
  // Bez významov je to len zoznam názvov — čipy sa čítajú lepšie než stĺpec.
  if (entries.every((entry) => !entry.meaning)) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        {entries.map(({ code }) => (
          <li
            key={code}
            className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground"
          >
            {code}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      {entries.map(({ code, meaning }) => (
        <div key={code} className="contents">
          <dt className="font-mono text-xs leading-5 text-foreground">{code}</dt>
          <dd className="leading-5 text-muted">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Predvolené kódy zamerania; `null` = disciplína preň žiadne nemá. */
export function drillGuide(
  discipline: Pick<DisciplineConfig, "drills" | "drillGlossary">,
  category: string,
): DrillGuide | null {
  const codes = discipline.drills[category] ?? [];
  if (codes.length === 0) return null;
  return codes.map((code) => ({ code, meaning: discipline.drillGlossary?.[code] }));
}
