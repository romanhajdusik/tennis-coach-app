import type { DisciplineConfig } from "@/lib/disciplines/types";
import { placeholderCourtSport } from "@/lib/disciplines/court-placeholder";

/**
 * P.L.A.W Padel — samostatné nasadenie toho istého repa na
 * `plawpadel.com` (od 2026-10-11 vlastná .com doména, rozhodol user; do vtedy
 * plánované `padel.plawsports.com`, docs §1.1). Zatiaľ dočasná
 * kostra s 9 zameraniami `FOCUS 1`…`FOCUS 9`; skutočné zamerania, kódy
 * a sadzby úderov doplní user.
 */
export const PADEL_DISCIPLINE: DisciplineConfig = placeholderCourtSport({
  id: "padel",
  label: "Padel",
  domain: "plawpadel.com",
});
