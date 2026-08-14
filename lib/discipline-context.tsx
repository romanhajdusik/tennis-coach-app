"use client";

import { createContext, useContext } from "react";
import type { DisciplineConfig } from "@/lib/disciplines/types";

/**
 * Disciplína pre klientske komponenty — formulár cvičenia a grafy ju
 * potrebujú, ale nesmú si ju čítať samy.
 *
 * PREČO NIE IMPORT: doteraz si ju brali priamo z `getDisciplineConfig()`,
 * čo funguje len dovtedy, kým je disciplína vecou NASADENIA (premenná sa
 * vloží pri builde). Vo federácii bude vlastnosťou ČLENSTVA prihláseného
 * trénera (docs/roadmap-buduce-smery.md §2.2) — a to sa v prehliadači
 * zistiť nedá. Preto ju appka podá zhora z `app/layout.tsx`; keď zdroj
 * pravdy pribudne, mení sa jedno miesto a komponenty ostávajú.
 */
const DisciplineContext = createContext<DisciplineConfig | null>(null);

export function DisciplineProvider({
  config,
  children,
}: {
  config: DisciplineConfig;
  children: React.ReactNode;
}) {
  return (
    <DisciplineContext.Provider value={config}>
      {children}
    </DisciplineContext.Provider>
  );
}

export function useDiscipline(): DisciplineConfig {
  const config = useContext(DisciplineContext);
  if (!config) {
    // Vlastná hláška, lebo bez providera by komponent spadol až na tom, že
    // číta pole z `null` — a to sa hľadá ťažko.
    throw new Error(
      "useDiscipline() sa volá mimo DisciplineProvider (sedí v app/layout.tsx)",
    );
  }
  return config;
}
