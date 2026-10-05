import type { DisciplineConfig } from "@/lib/disciplines/types";
import { placeholderCourtSport } from "@/lib/disciplines/court-placeholder";

/**
 * P.L.A.W Pickleball — samostatné nasadenie toho istého repa na
 * `pickleball.plawsports.com` (rozhodnuté 2026-10-05, docs §1.1). Zatiaľ dočasná
 * kostra s 9 zameraniami `FOCUS 1`…`FOCUS 9`; skutočné zamerania, kódy
 * a sadzby úderov doplní user.
 */
export const PICKLEBALL_DISCIPLINE: DisciplineConfig = placeholderCourtSport({
  id: "pickleball",
  label: "Pickleball",
  domain: "pickleball.plawsports.com",
});
