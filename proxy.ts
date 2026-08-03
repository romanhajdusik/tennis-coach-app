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
      return NextResponse.redirect(new URL(pathname + search, APP_ORIGIN), 307);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
