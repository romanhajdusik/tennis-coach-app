import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { ORG_HEADERS, type OrgContext } from "@/lib/org/context";

export async function updateSession(
  request: NextRequest,
  org: OrgContext | null = null,
) {
  // Org kontext sa vždy prepíše z overeného hostname — prichádzajúce hlavičky
  // sa najprv zahodia, aby si ich klient nemohol podvrhnúť (viď ORG_HEADERS).
  const requestHeaders = new Headers(request.headers);
  for (const header of Object.values(ORG_HEADERS)) {
    requestHeaders.delete(header);
  }
  if (org) {
    requestHeaders.set(ORG_HEADERS.id, org.id);
    requestHeaders.set(ORG_HEADERS.slug, org.slug);
    // Názov môže mať diakritiku, HTTP hlavičky sú ASCII.
    requestHeaders.set(ORG_HEADERS.name, encodeURIComponent(org.name));
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nutné volať getUser(), aby sa expirovaný access token vo Fázi za scénou obnovil
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, supabase, user };
}
