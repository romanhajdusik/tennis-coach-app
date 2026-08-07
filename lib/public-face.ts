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

/** Hostname bez portu, malými písmenami — tak, ako ho porovnáva proxy. */
export function normalizeHost(host: string | null | undefined) {
  return host?.split(":")[0].toLowerCase() ?? "";
}

export function isPublicFaceHost(host: string | null | undefined) {
  return PUBLIC_ONLY_HOSTS.has(normalizeHost(host));
}
