/**
 * Kresba organizácie pre stránku `/federation` (od 2026-10-12): pult
 * šéftrénera hore, tréneri v strede, hráči dole — celé v jednom rámčeku
 * s adresou organizácie. Ukazuje to, čo zväz kupuje (dáta tečú do jedného
 * pultu a ostávajú pod jednou strechou), a sedí pre každý šport — kurt by
 * zväz pripútal k jednému (rozhodol user po kritike Impeccable).
 *
 * Pravdivé detaily, nie ozdoba: jeden hráč patrí naraz trénerovi na kurte
 * aj kondičnému trénerovi (`player_assignments`), kondičný tréner je
 * odlíšený prerušovanou čiarou a adresa má tvar `<slug>.plawtennis.com`.
 *
 * Farbu berie z `currentColor` (rodič nastaví `text-primary`). Jediný pohyb
 * je tok dát po čiarach od trénera k pultu; pri `prefers-reduced-motion`
 * stojí (`.org-flow` v globals.css). Popisky ide z textov stránky.
 */
export type OrgDiagramLabels = {
  address: string;
  headCoach: string;
  coach: string;
  fitnessCoach: string;
  players: string;
};

const COACHES = [
  { x: 70, fitness: false },
  { x: 180, fitness: false },
  { x: 290, fitness: true },
];

// Hráč → index trénera. Hráč na x = 240 má dvoch: kurt aj kondičku.
const PLAYERS: { x: number; coaches: number[] }[] = [
  { x: 40, coaches: [0] },
  { x: 100, coaches: [0] },
  { x: 160, coaches: [1] },
  { x: 240, coaches: [1, 2] },
  { x: 320, coaches: [2] },
];

const COACH_Y = 190;
const PLAYER_Y = 262;

export function OrgDiagram({
  labels,
  className,
}: {
  labels: OrgDiagramLabels;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 320"
      role="img"
      aria-label={`${labels.address}: ${labels.headCoach}, ${labels.coach}, ${labels.fitnessCoach}, ${labels.players}`}
      className={className}
    >
      {/* Organizácia — všetko ostáva vnútri */}
      <rect
        x={8}
        y={8}
        width={344}
        height={304}
        rx={20}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeDasharray="6 6"
      />
      <text x={26} y={34} fontSize={11} className="fill-muted">
        {labels.address}
      </text>

      {/* Hráč → tréner */}
      <g stroke="currentColor" strokeOpacity={0.35} strokeWidth={1}>
        {PLAYERS.flatMap((player) =>
          player.coaches.map((index) => (
            <line
              key={`${player.x}-${index}`}
              x1={player.x}
              y1={PLAYER_Y - 7}
              x2={COACHES[index].x}
              y2={COACH_Y + 38}
            />
          )),
        )}
      </g>

      {/* Tréner → pult: tok dát smerom hore */}
      <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        {COACHES.map((coach) => (
          <path
            key={coach.x}
            d={`M${coach.x} ${COACH_Y - 15} L180 152`}
            strokeDasharray="3 5"
            className="org-flow"
          />
        ))}
      </g>

      {/* Pult šéftrénera */}
      <rect x={130} y={52} width={100} height={62} rx={8} fill="var(--color-surface)" stroke="currentColor" strokeWidth={1.5} />
      <g fill="currentColor" fillOpacity={0.75}>
        <rect x={150} y={84} width={12} height={18} rx={2} />
        <rect x={168} y={70} width={12} height={32} rx={2} />
        <rect x={186} y={78} width={12} height={24} rx={2} />
        <rect x={204} y={90} width={12} height={12} rx={2} />
      </g>
      <path d="M180 114V122M164 122H196" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <text x={180} y={144} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-foreground">
        {labels.headCoach}
      </text>

      {/* Tréneri */}
      {COACHES.map((coach) => (
        <g key={coach.x}>
          <circle
            cx={coach.x}
            cy={COACH_Y}
            r={14}
            fill="var(--color-surface)"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray={coach.fitness ? "3 3" : undefined}
          />
          <circle cx={coach.x} cy={COACH_Y} r={4} fill="currentColor" />
          <text x={coach.x} y={COACH_Y + 30} textAnchor="middle" fontSize={10} className="fill-muted">
            {coach.fitness ? labels.fitnessCoach : labels.coach}
          </text>
        </g>
      ))}

      {/* Hráči */}
      <g fill="currentColor" fillOpacity={0.55}>
        {PLAYERS.map((player) => (
          <circle key={player.x} cx={player.x} cy={PLAYER_Y} r={6} />
        ))}
      </g>
      <text x={180} y={294} textAnchor="middle" fontSize={10} className="fill-muted">
        {labels.players}
      </text>
    </svg>
  );
}
