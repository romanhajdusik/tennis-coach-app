import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { loadLegalDoc } from "@/lib/legal-docs";

// Zásady ochrany údajov pre zväz, klub a akadémiu. Žijú na `plaw.online`, kde
// je aj stránka `/federacie` — tam ich číta ich publikum.
//
// **Zmluvy sem nepatria.** Sprostredkovateľská zmluva podľa čl. 28 a hlavná
// zmluva o službe sa podpisujú, nezverejňujú sa; organizácia ich dostáva ako
// dokument (viď `docs/onboarding-organizacie.md`).
export const metadata: Metadata = {
  title: "Privacy Policy — P.L.A.W",
  description:
    "How P.L.A.W handles personal data for federations, clubs and academies.",
  robots: { index: false, follow: false },
};

export default async function ZasadyOrganizaciaPage() {
  const doc = await loadLegalDoc("gdpr-zasady-organizacia.md");

  return (
    <LegalPage
      doc={doc}
      audience="For federations, clubs and academies"
      sibling={{ href: "/federacie", label: "About the federation mode" }}
    />
  );
}
