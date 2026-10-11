/**
 * Padelový kurt zhora, v skutočných rozmeroch (10 × 20 m) — od 2026-10-11
 * náhrada fotky na landingu padelu. Padelová fotka zatiaľ nie je a tenisová
 * by klamala; kresba kurtu klamať nemôže a padelista ju spozná na prvý
 * pohľad (rozhodol user po kritike Impeccable).
 *
 * Súradnice sú v decimetroch: sieť v strede (y = 100), servisné čiary
 * 6,95 m od siete (y = 30.5 a 169.5), stredová čiara medzi nimi. Sklo je
 * hrubšia čiara: celé zadné steny a prvé 4 m bočných, zvyšok bočných strán
 * je pletivo (prerušovaná čiara).
 *
 * Farbu berie z `currentColor` — rodič nastaví `text-primary`, takže kurt
 * nesie farbu nasadenia. Hrúbka čiar sa pri zmene veľkosti nemení
 * (`non-scaling-stroke`), aby veľký kurt v úvode a malé značky pri bodoch
 * mali rovnako jemnú kresbu.
 */
const STROKE = { vectorEffect: "non-scaling-stroke" } as const;

function CourtLines({ glass = 2.5, line = 1 }: { glass?: number; line?: number }) {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {/* Pletivo na bočných stranách medzi sklom */}
      <path d="M0 40V160M100 40V160" strokeWidth={line} strokeDasharray="2 3" opacity={0.6} style={STROKE} />
      {/* Sklo: zadné steny a prvé štyri metre bočných */}
      <path d="M0 40V0H100V40M0 160V200H100V160" strokeWidth={glass} style={STROKE} />
      {/* Servisné čiary a stredová čiara */}
      <path d="M0 30.5H100M0 169.5H100M50 30.5V169.5" strokeWidth={line} style={STROKE} />
      {/* Sieť so stĺpikmi mimo kurtu */}
      <path d="M-3 100H103" strokeWidth={line * 1.6} style={STROKE} />
      <circle cx={-3} cy={100} r={1.6} fill="currentColor" stroke="none" />
      <circle cx={103} cy={100} r={1.6} fill="currentColor" stroke="none" />
    </g>
  );
}

/** Celý kurt na pozadie úvodnej obrazovky. Čisto dekoratívny. */
export function PadelCourt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="-6 -2 112 204"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <CourtLines glass={2.5} line={1} />
    </svg>
  );
}

export type CourtGlyphVariant = "drills" | "time" | "pair";

/**
 * Malá značka pri bode landingu — ten istý kurt s vyznačenou časťou, namiesto
 * ikonky v štvorčeku (ten je najbežnejší vzor SaaS landingov):
 * - `drills` — jedno servisné pole (miesto, kde sa cvičí),
 * - `time` — tri pásma polovice kurtu od siete dozadu, ako útočná,
 *   neutrálna a obranná hra v analytike,
 * - `pair` — dvaja hráči na jednej strane siete.
 */
export function PadelCourtGlyph({
  variant,
  className,
}: {
  variant: CourtGlyphVariant;
  className?: string;
}) {
  return (
    <svg aria-hidden viewBox="-6 -2 112 204" className={className}>
      {variant === "drills" && (
        <rect x={50} y={30.5} width={50} height={69.5} fill="currentColor" opacity={0.45} />
      )}
      {variant === "time" && (
        <g fill="currentColor">
          <rect x={0} y={100} width={100} height={35} opacity={0.6} />
          <rect x={0} y={135} width={100} height={34.5} opacity={0.35} />
          <rect x={0} y={169.5} width={100} height={30.5} opacity={0.15} />
        </g>
      )}
      {variant === "pair" && (
        <g fill="currentColor">
          <circle cx={27} cy={140} r={13} />
          <circle cx={73} cy={140} r={13} />
        </g>
      )}
      <CourtLines glass={2} line={1} />
    </svg>
  );
}
