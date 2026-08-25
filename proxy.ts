import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { orgSlugFromHost, resolveOrgBySlug } from "@/lib/org/resolve";
import {
  APP_ORIGIN,
  PARENT_ORIGIN,
  PUBLIC_ONLY_HOSTS,
  PUBLIC_ORIGIN,
  isParentFaceHost,
  isPublicFaceHost,
  normalizeHost,
} from "@/lib/public-face";

// plaw.online je samostatná verejná tvár projektu — ukazuje LEN rozcestník (/),
// návody a stránku pre federácie. Appka (login, dashboard, rodičovská časť,
// API) žije na plaw.win. Keďže je to jeden a ten istý Vercel projekt,
// rozdelenie robíme podľa hostname: na plaw.online povolíme len verejné cesty
// a všetko ostatné presmerujeme na rovnakú cestu na plaw.win.
// (Zoznam hostiteľov je v `lib/public-face.ts` — pozná ho aj `app/page.tsx`,
// ktorý podľa neho vykreslí rozcestník namiesto consumer landingu.)
const PUBLIC_PATHS = new Set([
  "/",
  "/navod",
  "/navod-hrac",
  "/cennik-hrac",
  "/federacie",
]);

// plaw.click hovorí k druhej strane appky (hráč, rodič, manažér), takže na nej
// nie je celý verejný web — len jej landing na `/` a dve stránky, na ktoré
// odkazuje. Trénerský marketing (`/navod`, cenník na landingu) sem nepatrí:
// kto sem prišiel, prišiel sa pozerať, nie trénovať.
const PARENT_FACE_PATHS = new Set(["/", "/navod-hrac", "/cennik-hrac"]);

// KAŽDÁ VEREJNÁ STRÁNKA MÁ PRÁVE JEDNU ADRESU (od 2026-08-24).
//
// Dovtedy odpovedali `/navod-hrac` a `/cennik-hrac` na TROCH hostiteľoch naraz
// (plaw.win, plaw.online aj plaw.click) a `/navod` na dvoch — jedna stránka,
// tri adresy. Kým je web `noindex`, nikomu to neškodí; pri spustení do
// vyhľadávačov by si tá istá stránka konkurovala sama so sebou a každý by
// zdieľal inú verziu odkazu.
//
// Domovom je vždy doména PUBLIKA tej stránky: návody a cenník pre sledujúceho
// patria na plaw.click (tú adresu dáva tréner rodičovi do ruky), trénerský
// návod a stránka pre federácie na rozcestník. Kto príde inde, dostane 307.
const CANONICAL_ORIGINS = new Map([
  ["/navod", PUBLIC_ORIGIN],
  ["/federacie", PUBLIC_ORIGIN],
  ["/navod-hrac", PARENT_ORIGIN],
  ["/cennik-hrac", PARENT_ORIGIN],
]);

/** Ktorej verejnej tvári patrí tento hostiteľ (`null` = produktová doména). */
function faceOriginOf(host: string) {
  if (isPublicFaceHost(host)) return PUBLIC_ORIGIN;
  if (isParentFaceHost(host)) return PARENT_ORIGIN;
  return null;
}
const LOGIN_PATH = "/login";

// Prihlásený účet BEZ členstva je typicky čerstvo pozvaný tréner — potrebuje
// zadať pozývací kód. Bez tejto výnimky ho stráž nižšie pošle na /login,
// zahodí mu session a onboarding sa zacyklí: kód nemá kde zadať.
const JOIN_PATH = "/join";
const REGISTER_PATH = "/register";

// Obnova hesla nezobrazuje žiadne dáta organizácie — je to len formulár.
// Stráž členstva ju preto musí pustiť: odkaz z mailu vytvorí na tejto
// subdoméne session a stráž by ju vzápätí zahodila, takže by sa nové heslo
// nedalo nastaviť (a pri účte inej organizácie by človek skončil na
// prihlásení bez vysvetlenia).
const PASSWORD_RESET_PATHS = new Set([
  "/forgot-password",
  "/reset-password",
  "/auth/confirm",
]);

// Supabase ukladá session do cookies `sb-<ref>-auth-token` (dlhé hodnoty sa
// delia na `...auth-token.0`, `.1`).
const AUTH_COOKIE_PATTERN = /^sb-.*auth-token/;

/**
 * Origin aktuálnej org subdomény. Skladá sa z hlavičky `Host`, nie
 * z `request.nextUrl` — ten sa v dev serveri Hostom neriadi (ukazuje na
 * localhost), čím by presmerovanie utieklo z org subdomény. Relatívna cesta
 * by bola najodolnejšia, ale Next middleware ju v `Location` neprijme.
 */
function originOf(request: NextRequest) {
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${request.headers.get("host")}`;
}

/** Zahodí session na TOMTO hostname (cookies sú host-only, inde ostáva platná). */
function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (AUTH_COOKIE_PATTERN.test(cookie.name)) {
      response.cookies.delete(cookie.name);
    }
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const host = normalizeHost(request.headers.get("host"));

  // Kanonizácia ide PRED rozdelením podľa hostiteľa — inak by si stránku stihol
  // vykresliť hostiteľ, ktorému nepatrí. Len GET: presmerovanie server action
  // na iný host by poslalo telo požiadavky inam.
  const canonical = CANONICAL_ORIGINS.get(request.nextUrl.pathname);
  if (
    canonical &&
    request.method === "GET" &&
    faceOriginOf(host) !== canonical
  ) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      canonical,
    );
    // Jazyk musí ísť s návštevníkom: cookie `LANDING_LOCALE` je viazaná na
    // doménu, takže by sa mu pri skoku stratil a slovenský návod by sa zmenil
    // na anglický. Číta ho `getLandingLocale` na druhej strane.
    const locale = request.cookies.get("LANDING_LOCALE")?.value;
    if (locale && !target.searchParams.has("lang")) {
      target.searchParams.set("lang", locale);
    }
    return NextResponse.redirect(target, 307);
  }

  if (PUBLIC_ONLY_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    // Verejné stránky nepotrebujú Supabase session (sú bez prihlásenia).
    if (PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next();
    }
    // Appkové cesty presmeruj na plaw.win + rovnaká cesta.
    return NextResponse.redirect(new URL(pathname + search, APP_ORIGIN), 307);
  }

  // plaw.click = landing pre hráča, rodiča a manažéra. Tá istá mechanika ako
  // pri plaw.online, len s vlastným (užším) zoznamom ciest: na `/` sa vykreslí
  // rodičovská landing (app/page.tsx), zvyšok ide na plaw.win. Cookies sú
  // per-doména, takže návštevník je tu vždy odhlásený a session netreba.
  if (isParentFaceHost(host)) {
    const { pathname, search } = request.nextUrl;
    if (PARENT_FACE_PATHS.has(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(pathname + search, APP_ORIGIN), 307);
  }

  // <slug>.plaw.win = federačná (B2B) subdoména organizácie (§5.2).
  const orgSlug = orgSlugFromHost(host);
  if (orgSlug) {
    return handleOrgRequest(request, orgSlug);
  }


  // plaw.win, *.vercel.app, localhost — samostatný (1:1) produkt.
  const { response } = await updateSession(request);
  return response;
}

/**
 * Požiadavka na subdoménu organizácie. Hostname je autoritatívny zdroj org
 * kontextu (§5.7 tenant izolácia) — appka ho ďalej číta cez getOrgContext().
 *
 * Session cookies sú host-only (nikde sa nenastavuje `domain`), takže
 * prihlásenie na jednej organizácii sa NEPRENÁŠA na inú ani na plaw.win.
 */
async function handleOrgRequest(request: NextRequest, slug: string) {
  const { pathname, search } = request.nextUrl;
  const org = await resolveOrgBySlug(slug);

  // Do federácie sa vstupuje POZÝVACÍM KÓDOM od šéftrénera, nie samoobslužnou
  // registráciou (§5.1, členstvo je dobrovoľné, ale prideľuje ho organizácia).
  // Kto si tu založí účet sám, vyrobí si samostatného trénera bez členstva —
  // a stráž nižšie ho aj tak vzápätí pošle na `/join`. Posielame ho tam rovno.
  if (pathname === REGISTER_PATH && request.method === "GET") {
    return NextResponse.redirect(new URL(JOIN_PATH, originOf(request)), 307);
  }

  // Neexistujúca organizácia sa správa, akoby subdoména nebola — pošleme
  // návštevníka na hlavnú doménu namiesto zobrazenia appky bez kontextu.
  if (!org) {
    return NextResponse.redirect(new URL(pathname + search, APP_ORIGIN), 307);
  }

  const { response, supabase, user } = await updateSession(request, org);

  // Stráž členstva: kto nie je aktívnym členom TEJTO organizácie, na jej
  // subdoméne nemá čo hľadať (napr. samostatný tréner alebo člen inej
  // federácie). Odhlásený návštevník prejde — potrebuje sa dostať na /login.
  //
  // Kontroluje sa len pri navigácii (GET): 307 na server action (POST) by
  // preposlal telo požiadavky na iný host, čo nechceme. Skutočnou hranicou
  // prístupu k dátam je aj tak RLS, nie hostname — stráž je tenant kontext
  // a UX, nie posledná obrana.
  if (user && request.method === "GET") {
    if (PASSWORD_RESET_PATHS.has(pathname)) {
      return response;
    }

    const { data: currentOrgId } = await supabase.rpc("current_org_id");

    if (currentOrgId !== org.id) {
      // Účet BEZ akéhokoľvek členstva pustíme na /join, aby mohol zadať
      // pozývací kód — session mu pritom nechávame, bez nej by claim nemal
      // koho pripojiť. Toto sa NETÝKA člena inej organizácie (ten má
      // currentOrgId vyplnené): toho aj naďalej vyhodíme, nech sa tenanty
      // nemiešajú. Hranicou dát je aj tak RLS — claim si oprávnenie overuje
      // sám (kód musí sedieť, účet nesmie mať osobné dáta, sedadlo musí byť
      // voľné).
      if (currentOrgId === null) {
        if (pathname === JOIN_PATH || pathname === LOGIN_PATH) {
          return response;
        }
        const joinUrl = new URL(JOIN_PATH, originOf(request));
        return NextResponse.redirect(joinUrl, 307);
      }

      // Cudziu session na tejto subdoméne zahodíme a necháme návštevníka na
      // prihlásení TEJTO organizácie. Skoršia verzia ho posielala na
      // plaw.win, čím vznikla slepá ulička: stráž presmerovala aj /login,
      // takže sa na subdoménu už nedalo prihlásiť ani správnym účtom.
      //
      // Session zahadzujeme zmazaním cookies, NIE cez supabase.auth.signOut():
      // tá aj so scope "local" volá /logout na serveri a zruší refresh token
      // danej session. Tu chceme len "na tomto hostname ťa nepoznáme" —
      // cookies sú host-only, takže prihlásenie toho istého účtu na plaw.win
      // ostáva nedotknuté.
      if (pathname === LOGIN_PATH) {
        return clearAuthCookies(request, response);
      }

      const loginUrl = new URL(LOGIN_PATH, originOf(request));

      return clearAuthCookies(request, NextResponse.redirect(loginUrl, 307));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
