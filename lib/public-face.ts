/**
 * plaw.online = samostatná **verejná tvár** projektu (marketing), plaw.win =
 * produkt. Rozdelenie robí `proxy.ts` podľa hostname, ale vedieť o ňom musí aj
 * `app/page.tsx`: na verejnej tvári je domovská stránka **rozcestník** medzi
 * dvoma produktmi, nie consumer landing.
 *
 * Preto je zoznam hostiteľov tu a nie v `proxy.ts` — jeden zdroj pravdy pre
 * obe strany. `PUBLIC_ORIGIN` je adresa, na ktorú sa marketingové cesty
 * presmerujú z produktovej domény.
 */
export const PUBLIC_ONLY_HOSTS = new Set(["plaw.online", "www.plaw.online"]);

export const PUBLIC_ORIGIN = "https://plaw.online";

/**
 * Adresa produktu. Sem sa z marketingových domén presmeruje všetko, čo nie je
 * verejná stránka (login, appka, API) — a odtiaľto vedú odkazy „Si tréner?".
 */
export const APP_ORIGIN = "https://plaw.win";

/**
 * plaw.click = **tretia verejná doména: landing pre hráča, rodiča a manažéra**
 * (od 2026-08-22). Dovtedy hovoril celý verejný web výhradne k trénerovi —
 * druhá strana appky mala len návod (`/navod-hrac`) a cenník (`/cennik-hrac`),
 * čo sú vysvetlenia, nie predaj.
 *
 * Je to vlastná doména a nie ďalšia cesta na plaw.win zámerne: je to adresa,
 * ktorú dá tréner rodičovi do ruky, takže má byť krátka a nemá viesť na
 * stránku, ktorá predáva niečo iné.
 *
 * Funguje rovnako ako plaw.online — ten istý Vercel projekt, rozdelenie podľa
 * hostname: `/` vykreslí rodičovskú landing (`app/page.tsx`), povolené sú
 * navyše len jej dve odkazované stránky a všetko ostatné ide 307 na plaw.win.
 * Cookies sú per-doména, takže návštevník je tu vždy odhlásený.
 */
export const PARENT_FACE_HOSTS = new Set(["plaw.click", "www.plaw.click"]);

export const PARENT_ORIGIN = "https://plaw.click";

/** Hostname bez portu, malými písmenami — tak, ako ho porovnáva proxy. */
export function normalizeHost(host: string | null | undefined) {
  return host?.split(":")[0].toLowerCase() ?? "";
}

export function isPublicFaceHost(host: string | null | undefined) {
  return PUBLIC_ONLY_HOSTS.has(normalizeHost(host));
}

export function isParentFaceHost(host: string | null | undefined) {
  return PARENT_FACE_HOSTS.has(normalizeHost(host));
}

const APP_HOSTS = new Set(["plaw.win", "www.plaw.win"]);

/**
 * Ktorej z našich verejných adries tento hostiteľ JE — vstup pre kanonizáciu
 * v `proxy.ts` (každá verejná stránka má práve jednu adresu).
 *
 * `null` znamená „žiadna z nich": org subdoména (tá nie je domovom žiadnej
 * verejnej stránky, takže sa z nej kanonizuje preč) a rovnako aj localhost,
 * LAN adresa či `*.vercel.app`. Tie sa **nekanonizujú vôbec** — inak by sa
 * lokálny vývoj a preview nasadenie pri otvorení návodu presmerovali na
 * produkciu a stránka by sa nedala pozrieť tam, kde sa práve robí.
 */
export function faceOriginOf(host: string | null | undefined) {
  const hostname = normalizeHost(host);
  if (PUBLIC_ONLY_HOSTS.has(hostname)) return PUBLIC_ORIGIN;
  if (PARENT_FACE_HOSTS.has(hostname)) return PARENT_ORIGIN;
  if (APP_HOSTS.has(hostname)) return APP_ORIGIN;
  return null;
}
