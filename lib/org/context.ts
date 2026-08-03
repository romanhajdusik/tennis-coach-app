import { headers } from "next/headers";

/**
 * Organizácia (federácia/klub/akadémia), do ktorej patrí aktuálna požiadavka —
 * určená subdoménou `<slug>.plaw.win`. Na `plaw.win` je vždy null = samostatný
 * (1:1) produkt. Pozri docs/roadmap-buduce-smery.md §5.2 a §5.3.
 */
export type OrgContext = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Hlavičky, ktorými `proxy.ts` podáva org kontext do appky.
 *
 * BEZPEČNOSŤ: proxy ich z prichádzajúcej požiadavky vždy najprv ODSTRÁNI a
 * nastaví nanovo z overeného hostname. Bez toho by si ich hocikto mohol poslať
 * sám a predstierať príslušnosť k cudzej organizácii. Appka preto smie org
 * kontext čítať výhradne cez `getOrgContext()`, nikdy priamo z hlavičky.
 */
export const ORG_HEADERS = {
  id: "x-plaw-org-id",
  slug: "x-plaw-org-slug",
  name: "x-plaw-org-name",
} as const;

/** Prečíta org kontext v Server Component / server action. Null = samostatný režim. */
export async function getOrgContext(): Promise<OrgContext | null> {
  const headerList = await headers();

  const id = headerList.get(ORG_HEADERS.id);
  const slug = headerList.get(ORG_HEADERS.slug);
  const name = headerList.get(ORG_HEADERS.name);

  if (!id || !slug || !name) {
    return null;
  }

  // Názov organizácie môže mať diakritiku, HTTP hlavičky sú ASCII — proxy ho
  // preto posiela percent-enkódovaný.
  return { id, slug, name: decodeURIComponent(name) };
}
