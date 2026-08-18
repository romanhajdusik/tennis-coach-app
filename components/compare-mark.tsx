// Značka „áno / nie" v porovnávacích tabuľkách cenníkov. Zdieľajú ju cenník
// trénera na landingu a cenník pre hráča/rodiča/manažéra na `/cennik-hrac`,
// aby obe tabuľky vyzerali rovnako — sú to dve strany tej istej ponuky.
//
// Zámerne bez `"use client"`: je to čistý markup bez stavu, takže sa dá
// vykresliť aj v serverovej stránke, aj vnútri klientského komponentu.
export function CompareMark({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 0 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
        <path d="M4.5 9h11v2h-11z" />
      </svg>
    </span>
  );
}
