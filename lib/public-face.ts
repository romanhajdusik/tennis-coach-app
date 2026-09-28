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

/**
 * Kondičné nasadenie — NAŠE, ale nie je domovom žiadnej verejnej stránky.
 * Je to druhá appka nad tým istým kódom (`NEXT_PUBLIC_PLAW_DISCIPLINE`),
 * nie ďalšia verejná tvár: marketing nemá (landing by tu bol nepravdivý,
 * viď `components/discipline-intro.tsx`) a právne stránky patria doméne
 * svojho publika.
 *
 * Preto NEPATRÍ do `faceOriginOf` — ten vracia adresu, na ktorej stránka
 * BÝVA, a kondička ňou nie je pre žiadnu. Je tu preto, aby ju `proxy.ts`
 * počítal medzi hostiteľov, na ktorých sa kanonizuje: do 2026-09-28 sa na
 * nej `/podmienky` a spol. vykresľovali druhýkrát, teda tá istá stránka na
 * dvoch adresách. Kým je web `noindex`, neškodí to; po spustení
 * indexovania by si stránky kazili poradie navzájom.
 */
export const FITNESS_HOSTS = new Set(["fitness.plawsports.com"]);

export function isFitnessHost(host: string | null | undefined) {
  return FITNESS_HOSTS.has(normalizeHost(host));
}

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
 * `null` znamená „žiadna z nich" a pokrýva DVE rôzne veci. Prvá: naše
 * hostitele, ktoré nie sú domovom žiadnej verejnej stránky — org subdoména
 * a kondičné nasadenie (`FITNESS_HOSTS`). Z tých sa kanonizuje **preč**;
 * `proxy.ts` si ich preto do `ours` pripočítava zvlášť. Druhá: localhost,
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
