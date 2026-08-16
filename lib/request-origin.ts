import { headers } from "next/headers";

/**
 * Origin aktuálnej požiadavky poskladaný z hlavičky `Host`.
 *
 * Appka beží na viacerých hostoch nad jedným Supabase Auth (`plaw.win`,
 * org subdomény `<slug>.plaw.win`, kondička `fitness.plawsports.com`,
 * `*.vercel.app`), takže odkaz v maili musí viesť späť tam, odkiaľ človek
 * odišiel — natvrdo zapísaná adresa by federačného trénera vyhodila z jeho
 * subdomény a spolu s ňou aj zo session (cookies sú host-only).
 *
 * Rovnaký princíp ako `originOf()` v `proxy.ts`: `request.url` sa v dev
 * serveri hlavičkou `Host` neriadi (ukazuje na localhost), takže by
 * presmerovanie utieklo z testovanej subdomény.
 */
export async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}
