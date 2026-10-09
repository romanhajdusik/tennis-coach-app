/**
 * Zoznam „kód → čo znamená" pre predvolené kódy jedného zamerania (od
 * 2026-10-09). Bez hookov, takže ho vie vykresliť appková stránka s kódmi
 * (klientsky formulár) aj verejný návod (serverová stránka).
 */
export function DrillGlossaryList({
  entries,
}: {
  entries: { code: string; meaning: string }[];
}) {
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

/** Predvolené kódy zamerania, ku ktorým konfigurácia pozná význam. */
export function glossaryEntries(
  codes: string[] | undefined,
  glossary: Record<string, string> | undefined,
) {
  if (!codes || !glossary) return [];
  return codes
    .filter((code) => glossary[code])
    .map((code) => ({ code, meaning: glossary[code] }));
}
