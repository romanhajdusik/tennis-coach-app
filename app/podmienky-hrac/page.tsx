import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { loadLegalDoc } from "@/lib/legal-docs";

// Podmienky pre sledujúceho (rodič, manažér, hráč). Žijú na `plaw.click` —
// doméne ich publika, viď `CANONICAL_ORIGINS` v `proxy.ts`. Text sa číta zo
// schváleného dokumentu v `docs/`, rovnako ako trénerské podmienky.
export const metadata: Metadata = {
  title: "Terms of Use — P.L.A.W",
  description:
    "Terms of use for parents, managers and players who follow a player's training.",
  robots: { index: false, follow: false },
};

export default async function PodmienkyHracPage() {
  const doc = await loadLegalDoc("podmienky-sledujuci.md");

  return (
    <LegalPage
      doc={doc}
      audience="For parents, players and managers"
      sibling={{ href: "/zasady-hrac", label: "Privacy Policy" }}
    />
  );
}
