type IconProps = { className?: string };

const base = "h-6 w-6";

export function CalendarIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17" strokeLinecap="round" />
      <path d="M8 3v4M16 3v4" strokeLinecap="round" />
      <path d="M7.5 13h3M13.5 13h3M7.5 16.5h3M13.5 16.5h3" strokeLinecap="round" />
    </svg>
  );
}

export function ClipboardCheckIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <rect x="5" y="4.5" width="14" height="17" rx="2.5" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" />
      <path d="M8.5 13.5l2.3 2.3L15.5 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TagIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path d="M11.5 3.5H5A1.5 1.5 0 0 0 3.5 5v6.5a1.5 1.5 0 0 0 .44 1.06l9 9a1.5 1.5 0 0 0 2.12 0l6.44-6.44a1.5 1.5 0 0 0 0-2.12l-9-9a1.5 1.5 0 0 0-1.06-.44Z" strokeLinejoin="round" />
      <circle cx="8.25" cy="8.25" r="1.4" />
    </svg>
  );
}

export function ChartBarIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path d="M4 20.5V10M4 20.5h16M9.5 20.5V6M15 20.5v-8M20 20.5V3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UsersIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.75 19.5c.6-3.1 3.1-5.25 6.25-5.25s5.65 2.15 6.25 5.25" strokeLinecap="round" />
      <path d="M15.5 5.4a3 3 0 0 1 0 5.6" strokeLinecap="round" />
      <path d="M16.75 14.4c2.55.5 4.4 2.4 4.9 5.1" strokeLinecap="round" />
    </svg>
  );
}

export function DeviceMobileIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.2h3" strokeLinecap="round" />
    </svg>
  );
}
