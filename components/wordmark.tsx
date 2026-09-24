import { Fragment } from "react";

/**
 * Textová značka „P.L.A.W" s bodkami v primárnej farbe — tá istá podoba, akú
 * má hlavička domovskej obrazovky trénera.
 *
 * **Obrázkové logo sa na verejnom webe nepoužíva** (rozhodol používateľ
 * 2026-09-24): zmizlo z hlavičiek aj z úvodných kariet na všetkých verejných
 * stránkach. Nevracaj `plaw-logo.webp` späť bez nového rozhodnutia.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  const letters = "P.L.A.W".split(".");

  return (
    <span
      className={`font-sans text-lg font-extrabold tracking-tight text-foreground ${className}`}
    >
      {letters.map((letter, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="text-primary">.</span>}
          {letter}
        </Fragment>
      ))}
    </span>
  );
}
