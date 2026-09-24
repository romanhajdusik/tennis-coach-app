import { Fragment } from "react";

/**
 * Textová značka „P.L.A.W" s bodkami v primárnej farbe — tá istá podoba, akú
 * má hlavička domovskej obrazovky trénera.
 *
 * **Obrázkové logo sa na verejnom webe nepoužíva** (rozhodol používateľ
 * 2026-09-24): zmizlo z hlavičiek aj z úvodných kariet na všetkých verejných
 * stránkach. Nevracaj `plaw-logo.webp` späť bez nového rozhodnutia.
 */
type Variant =
  /** Drobná značka v hlavičke stránky — bodky nesú primárnu farbu. */
  | "nav"
  /** Veľký nápis v úvode, ako na úvodnej obrazovke appky (ľahký, rozpálcovaný). */
  | "hero";

export function Wordmark({
  variant = "nav",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const letters = "P.L.A.W".split(".");

  // Úvodný nápis je zámerne ten istý ako na úvodnej obrazovke appky
  // (`components/discipline-intro.tsx` a hero landingu na telefóne) — aby
  // človek videl tú istú značku na webe aj po prihlásení.
  if (variant === "hero") {
    // Na úzkom telefóne (320 px) by nápis v plnej veľkosti pretiekol a rozhýbal
    // celú stránku do strán — preto menšia veľkosť pod `sm`.
    return (
      <span
        className={`mr-[-0.25em] font-sans text-4xl font-light tracking-[0.25em] text-foreground sm:text-5xl ${className}`}
      >
        P.L.A.W
      </span>
    );
  }

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
