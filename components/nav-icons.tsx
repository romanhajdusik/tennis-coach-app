// Farebné ikonky spodnej lišty trénerovej appky (od 2026-09-21, podľa zadania
// používateľa). Na rozdiel od zvyšku appky majú farby NATVRDO: sú to malé
// ilustrácie, nie stav ani značka, a majú vyzerať rovnako v tenise, kondičke
// aj vo federácii. Jediná výnimka je dvere domčeka — tie berú farbu lišty
// (`--color-surface`), aby pôsobili ako otvor.
//
// Farby grafov v donute sú tie isté ako séria v `.viz-root` (globals.css),
// zelená a červená v mobile sú stavy tréningu (naplánovaný / dokončený).

type IconProps = { className?: string };

const base = "h-[31px] w-[31px]";

export function HomeNavIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path
        d="M16 3.6 2.9 14.6h3.6v12.4a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5V14.6h3.6Z"
        fill="#f5c542"
        stroke="#f5c542"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="13.2" y="19" width="5.6" height="9.5" rx="1" fill="var(--color-surface)" />
    </svg>
  );
}

/** Traja hráči v obrysoch — žltý, červený a zelený vpredu. */
export function PlayersNavIcon({ className = base }: IconProps) {
  const stroke = {
    fill: "none",
    strokeWidth: 2.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="7.4" cy="12" r="2.9" stroke="#f5c542" {...stroke} />
      <path d="M2.6 25.2c.3-3.3 2.4-5.4 5.2-5.6 1.2 0 2.3.3 3.2.9" stroke="#f5c542" {...stroke} />
      <circle cx="24.6" cy="12" r="2.9" stroke="#e66767" {...stroke} />
      <path d="M29.4 25.2c-.3-3.3-2.4-5.4-5.2-5.6-1.2 0-2.3.3-3.2.9" stroke="#e66767" {...stroke} />
      <circle cx="16" cy="10" r="3.8" stroke="#34c77b" {...stroke} />
      <path d="M9.4 26.5c.5-4.3 3.2-7.1 6.6-7.1s6.1 2.8 6.6 7.1" stroke="#34c77b" {...stroke} />
    </svg>
  );
}

/** Mobil so zoznamom tréningov — zelené naplánované, červené dokončené. */
export function PracticesNavIcon({ className = base }: IconProps) {
  const row = (y: number, length: number, color: string) => (
    <path
      d={`M12 ${y}h${length}`}
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  );
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="7" y="1.8" width="18" height="28.4" rx="3.6" fill="#6b7872" />
      <rect x="9.2" y="5" width="13.6" height="22.4" rx="1.7" fill="#eef1ec" />
      <rect x="13.8" y="2.8" width="4.4" height="1.2" rx=".6" fill="#eef1ec" opacity=".7" />
      {row(10, 8, "#34c77b")}
      {row(14.6, 5.6, "#e66767")}
      {row(19.2, 8, "#34c77b")}
      {row(23.8, 4.4, "#e66767")}
    </svg>
  );
}

export function CalendarNavIcon({ className = base }: IconProps) {
  const days: [number, number][] = [
    [8, 16.5],
    [13, 16.5],
    [18, 16.5],
    [23, 16.5],
    [8, 21.8],
    [13, 21.8],
    [23, 21.8],
  ];
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="4" y="6" width="24" height="22.5" rx="3" fill="#eef1ec" />
      <path d="M4 9a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v4H4Z" fill="#e66767" />
      <rect x="8.6" y="3.2" width="2.6" height="6" rx="1.3" fill="#9ba59e" />
      <rect x="20.8" y="3.2" width="2.6" height="6" rx="1.3" fill="#9ba59e" />
      {days.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 1.4} y={y} width="2.8" height="2.8" rx=".6" fill="#8a948d" />
      ))}
      <rect x="15.8" y="20.6" width="4.4" height="5.2" rx="1.2" fill="#34c77b" />
    </svg>
  );
}

/** Donut vo farbách grafov analytiky. */
export function AnalyticsNavIcon({ className = base }: IconProps) {
  const parts: [number, string][] = [
    [0.4, "#3987e5"],
    [0.25, "#199e70"],
    [0.2, "#c98500"],
    [0.15, "#9085e9"],
  ];
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const gap = 1.1;
  let offset = 0;

  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      {parts.map(([share, color]) => {
        const length = share * circumference - gap;
        const segment = (
          <circle
            key={color}
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6.5"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 16 16)"
          />
        );
        offset += share * circumference;
        return segment;
      })}
    </svg>
  );
}

/** Odhlásenie — obrysová, ako ostatné malé ikonky v hlavičke. */
export function LogoutIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 16l-4-4 4-4" />
      <path d="M6 12h10" />
    </svg>
  );
}
