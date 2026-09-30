import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { loadLegalDoc } from "@/lib/legal-docs";
import { publicRobots } from "@/lib/seo";

// Podmienky používania pre trénera. Text sa číta zo schváleného dokumentu
// `docs/podmienky-trener.md` — nekopíruje sa sem ani do `messages/`, aby sa
// znenie nerozišlo (rovnaký zdroj používa Word aj čitateľská stránka).
// Zámerne noindex, kým nie je appka verejne spustená — rovnako ako landing.
export const metadata: Metadata = {
  title: "Terms of Use — P.L.A.W",
  description: "Terms of use of the P.L.A.W application for coaches.",
  robots: publicRobots(),
};

export default async function PodmienkyPage() {
  const doc = await loadLegalDoc("podmienky-trener.md");

  return (
    <LegalPage
      doc={doc}
      audience="For coaches"
      sibling={{ href: "/zasady", label: "Privacy Policy" }}
    />
  );
}
