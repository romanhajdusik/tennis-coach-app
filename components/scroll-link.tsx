"use client";

import type { ReactNode } from "react";

/**
 * Odkaz, ktorý plynulo posunie stránku na prvok s daným `id`. Bez JS funguje
 * ako obyčajná kotva (`#id`), takže skočí aj vtedy, keď sa skript nenačíta.
 *
 * Plynulý posun sa zámerne nerieši cez `scroll-behavior: smooth` na `<html>`
 * — ten by platil pre celú appku vrátane prechodov medzi stránkami.
 */
export function ScrollLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}
