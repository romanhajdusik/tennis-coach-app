import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

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

  // plaw.win, *.vercel.app, localhost — bežné správanie so Supabase session.
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
