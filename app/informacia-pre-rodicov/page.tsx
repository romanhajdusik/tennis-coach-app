import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { loadParentNotice } from "@/lib/legal-docs";

// Text, ktorý tréner odovzdáva rodičovi. Nie je to dokument, ktorý viaže
// čitateľa — je to hotový text na odovzdanie, aby tréner nemusel informačnú
// povinnosť podľa čl. 13 riešiť sám (docs/gdpr-mapa-roli.md §5.1: pri údajoch
// o dieťati je prevádzkovateľom TRÉNER, nie P.L.A.W).
//
// Žije na plaw.click, lebo číta ho RODIČ — tréner mu sem pošle odkaz. Tú istú
// adresu menujú zásady pre trénera, takže ak sa mení, musí sa zmeniť aj tam.
// Zámerne noindex, kým nie je appka verejne spustená — rovnako ako ostatné.
export const metadata: Metadata = {
  title: "Information for parents — P.L.A.W",
  description:
    "A ready-made notice a coach can hand to a parent about how their child's training records are kept.",
  robots: { index: false, follow: false },
};

export default async function InformaciaPreRodicovPage() {
  const doc = await loadParentNotice();

  return (
    <LegalPage
      doc={doc}
      audience="For parents"
      intro={
        <>
          <strong className="font-semibold text-foreground">
            Coaches: two things before you hand this over.
          </strong>{" "}
          Replace the two highlighted places with your name and contact details —
          you are the one keeping the records, we only store them for you. And use
          the optional paragraph at the end only if you really do write down
          injuries or health data; it needs the parent&apos;s explicit consent.
          Nothing here is signed otherwise — it is information, not a consent form.
        </>
      }
    />
  );
}
