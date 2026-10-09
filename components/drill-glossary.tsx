import type { DisciplineConfig } from "@/lib/disciplines/types";

export type DrillGuide = {
  /**
   * `defaults` = kódy, ktoré tréner v slotoch naozaj má (tenis); `examples` =
   * len ukážka pri prázdnych slotoch (kondička). Rozlišuje sa preto, lebo
   * pri ukážke musí byť jasne povedané, že sa do slotov nič nezapísalo
   * a cvičenia si tréner pomenuje po svojom (rozhodol user 2026-10-09).
   */
  kind: "defaults" | "examples";
  /** `meaning` chýba pri ukážke bez skratiek (kondička píše plné názvy). */
  entries: { code: string; meaning?: string }[];
};

/**
 * Zoznam „kód → čo znamená" (od 2026-10-09). Bez hookov, takže ho vie
 * vykresliť appková stránka s kódmi (klientsky formulár) aj verejný návod.
 */
export function DrillGlossaryList({ entries }: { entries: DrillGuide["entries"] }) {
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

/**
 * Vysvetlivky pre jedno zameranie: predvolené kódy, ak ich disciplína má,
 * inak ukážkové. `null` = disciplína k zameraniu nič nepozná.
 */
export function drillGuide(
  discipline: Pick<DisciplineConfig, "drills" | "drillExamples" | "drillGlossary">,
  category: string,
): DrillGuide | null {
  const glossary = discipline.drillGlossary ?? {};
  const defaults = discipline.drills[category] ?? [];
  const kind = defaults.length > 0 ? "defaults" : "examples";
  const codes = kind === "defaults" ? defaults : (discipline.drillExamples?.[category] ?? []);
  // Predvolený kód bez významu sa nevypíše (vysvetlivka bez vysvetlenia);
  // ukážka sa vypíše vždy, aj keď je to len názov.
  const entries = codes
    .filter((code) => kind === "examples" || glossary[code])
    .map((code) => ({ code, meaning: glossary[code] }));
  return entries.length > 0 ? { kind, entries } : null;
}
