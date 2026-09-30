import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { loadLegalDoc } from "@/lib/legal-docs";
import { publicRobots } from "@/lib/seo";

// Zásady ochrany údajov pre sledujúceho — pozri komentár v `/podmienky-hrac`.
export const metadata: Metadata = {
  title: "Privacy Policy — P.L.A.W",
  description:
    "How P.L.A.W handles personal data of parents, managers and players who follow training.",
  robots: publicRobots(),
};

export default async function ZasadyHracPage() {
  const doc = await loadLegalDoc("gdpr-zasady-sledujuci.md");

  return (
    <LegalPage
      doc={doc}
      audience="For parents, players and managers"
      sibling={{ href: "/podmienky-hrac", label: "Terms of Use" }}
    />
  );
}
