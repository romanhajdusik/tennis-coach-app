import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/request-origin";

/**
 * Pristátie po kliknutí na odkaz z mailu (dnes obnova hesla).
 *
 * Je to route handler, nie stránka, lebo výmena tokenu za session ZAPISUJE
 * cookies — a to Next dovolí len v route handleri alebo server action, nie pri
 * rendrovaní stránky.
 *
 * Zvláda obe podoby odkazu, ktoré Supabase posiela:
 * - `token_hash` + `type` — funguje aj vtedy, keď človek otvorí mail na inom
 *   zariadení, než z ktorého o obnovu požiadal. Vyžaduje si šablónu mailu
 *   prepísanú na `{{ .TokenHash }}` (viď docs/obnova-hesla.md).
 * - `code` — predvolená šablóna Supabase. Kód sa páruje s overovacím reťazcom
 *   uloženým v cookie, takže odkaz musí otvoriť TEN ISTÝ prehliadač, ktorý
 *   o obnovu požiadal; inak výmena zlyhá a človek dostane ponuku vyžiadať si
 *   nový odkaz.
 */
const NEW_PASSWORD_PATH = "/reset-password";

/** Typy odkazov, ktoré sme ochotní prijať — dnes výhradne obnova hesla. */
const ALLOWED_TYPES: EmailOtpType[] = ["recovery"];

/**
 * Cieľ presmerovania musí byť cesta v tejto appke. Bez tejto kontroly by
 * `?next=https://cudzia.stranka` spravil z appky otvorené presmerovanie —
 * odkaz z dôveryhodného mailu by viedol kamkoľvek. `//host` je tiež absolútna
 * adresa, hoci sa začína lomkou.
 */
function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return NEW_PASSWORD_PATH;
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const origin = await requestOrigin();
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = await createClient();
  let verified = false;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    verified = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  // Neplatný, vypršaný alebo už použitý odkaz nesmie skončiť prázdnou
  // stránkou — stránka nižšie z toho spraví ponuku vyžiadať si nový.
  const target = verified ? next : `${NEW_PASSWORD_PATH}?error=link`;

  return NextResponse.redirect(new URL(target, origin), 303);
}
