"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Meranie návštevnosti VEREJNÉHO webu (od 2026-10-07) — Vercel Web Analytics,
 * bez cookies a bez ukladania IP adries. Účel: zistiť, kde odchádzajú ľudia
 * z reklamy (prvá kampaň priniesla 1 091 návštev a najviac jednu registráciu).
 *
 * **Do appky po prihlásení NEPATRÍ** (rozhodol user pri zavedení): adresy
 * v appke nesú identifikátory hráčov a tréningov a odkaz na obnovu hesla
 * jednorazový kľúč. Komponent sa preto vkladá len do verejných stránok
 * (landing v odhlásenej vetve `app/page.tsx`, návody, cenník, `/federacie`,
 * `/register`) — nie do `app/layout.tsx`.
 *
 * `beforeSend` je druhá poistka: pustí len cesty zo zoznamu nižšie a vždy
 * zahodí query aj hash. `/` je na zozname, lebo landing žije na `/`; prihlásený
 * na `/` komponent nedostane vôbec (vetva `user` ho nevykreslí).
 *
 * Meranie je uvedené v zásadách pre trénera — pri pridaní stránky
 * na zoznam over, či to zásady stále pokrývajú.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/navod",
  "/navod-hrac",
  "/navod-self",
  "/cennik-hrac",
  "/federacie",
  "/register",
]);

function onlyPublicPages(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (!PUBLIC_PATHS.has(url.pathname)) return null;
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function PublicAnalytics() {
  return <Analytics beforeSend={onlyPublicPages} />;
}
