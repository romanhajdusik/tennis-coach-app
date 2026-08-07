import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { orgSlugFromHost, resolveOrgBySlug } from "@/lib/org/resolve";

// plaw.online je samostatná verejná tvár projektu — ukazuje LEN landing (/) a
// návod (/navod). Appka (login, dashboard, rodičovská časť, API) žije na
// plaw.win. Keďže je to jeden a ten istý Vercel projekt, rozdelenie robíme
// podľa hostname: na plaw.online povolíme len verejné cesty a všetko ostatné
// presmerujeme na rovnakú cestu na plaw.win.
const PUBLIC_ONLY_HOSTS = new Set(["plaw.online", "www.plaw.online"]);
const PUBLIC_PATHS = new Set(["/", "/navod", "/navod-hrac"]);
const APP_ORIGIN = "https://plaw.win";
const LOGIN_PATH = "/login";

// Prihlásený účet BEZ členstva je typicky čerstvo pozvaný tréner — potrebuje
// zadať pozývací kód. Bez tejto výnimky ho stráž nižšie pošle na /login,
// zahodí mu session a onboarding sa zacyklí: kód nemá kde zadať.
const JOIN_PATH = "/join";

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
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";

  if (PUBLIC_ONLY_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    // Verejné stránky nepotrebujú Supabase session (sú bez prihlásenia).
    if (PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next();
    }
    // Appkové cesty presmeruj na plaw.win + rovnaká cesta.
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
