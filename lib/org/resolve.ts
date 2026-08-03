import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import type { OrgContext } from "@/lib/org/context";

/**
 * Multi-tenant mapovanie hostname → organizácia (§5.2).
 *
 * Každá organizácia má vlastnú subdoménu `<slug>.plaw.win`, ktorá sa pridáva
 * RUČNE per organizácia (CNAME vo Websupporte + doména vo Verceli) — preto sa
 * kód nemení pri pridaní ďalšej organizácie, mení sa len obsah tabuľky
 * `organizations`. Postup je v docs/mockups/onboarding-org.html.
 */
const ORG_HOST_SUFFIX = ".plaw.win";

/**
 * Subdomény, ktoré NIE SÚ organizácie. `www` je alias hlavnej domény;
 * ostatné sú rezervované, aby sa nedali obsadiť ako slug organizácie.
 */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ftp",
  "ns1",
  "ns2",
]);

/** Vráti slug organizácie z hostname, alebo null ak to nie je org subdoména. */
export function orgSlugFromHost(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  if (!hostname.endsWith(ORG_HOST_SUFFIX)) {
    return null;
  }

  const slug = hostname.slice(0, -ORG_HOST_SUFFIX.length);

  // Prázdne (samotné plaw.win), viacúrovňové (a.b.plaw.win) ani rezervované
  // subdomény nie sú organizácie.
  if (!slug || slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) {
    return null;
  }

  return slug;
}

// Organizácií je málo a menia sa zriedka, ale proxy beží pri KAŽDEJ požiadavke —
// krátka pamäť ušetrí dotaz do DB na každý obrázok či navigáciu. Cachujú sa aj
// neexistujúce slugy, aby sa nedali použiť na zaťaženie DB.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { org: OrgContext | null; expiresAt: number }>();

/**
 * Načíta organizáciu podľa slugu. Číta sa cez `security definer` funkciu
 * `organization_by_slug`, ktorá vracia len verejné polia (názov, slug, šport) —
 * volá sa ešte pred prihlásením, takže sa cez ňu nesmie dať zistiť nič
 * o predplatnom ani o počte sedadiel.
 */
export async function resolveOrgBySlug(slug: string): Promise<OrgContext | null> {
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.org;
  }

  // Anonymný klient bez session — org kontext sa určuje z hostname, nie
  // z prihláseného používateľa.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );

  const { data, error } = await supabase.rpc("organization_by_slug", {
    p_slug: slug,
  });

  const row = error ? null : data?.[0];
  const org: OrgContext | null = row
    ? { id: row.id, slug: row.slug, name: row.name }
    : null;

  // Chybu (výpadok DB) necachujeme nakrátko ako neexistujúcu organizáciu —
  // radšej sa spýtame znova pri ďalšej požiadavke.
  if (!error) {
    cache.set(slug, { org, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return org;
}
