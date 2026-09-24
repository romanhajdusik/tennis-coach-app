import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { loadLegalDoc } from "@/lib/legal-docs";

// Zásady ochrany osobných údajov pre trénera — pozri komentár v `/podmienky`.
// Pre sledujúceho a pre organizáciu budú vlastné stránky na ich doménach,
// lebo každá verejná stránka má práve jednu adresu (CANONICAL_ORIGINS).
export const metadata: Metadata = {
  title: "Privacy Policy — P.L.A.W",
  description: "How P.L.A.W handles personal data of coaches and their players.",
  robots: { index: false, follow: false },
};

export default async function ZasadyPage() {
  const doc = await loadLegalDoc("gdpr-zasady-trener.md");

  return (
    <LegalPage
      doc={doc}
      audience="For coaches"
      sibling={{ href: "/podmienky", label: "Terms of Use" }}
    />
  );
}
