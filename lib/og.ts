// Náhľadový obrázok odkazu (Open Graph) — to, čo sa vykreslí, keď niekto
// vloží adresu P.L.A.W do správy alebo na sociálnu sieť.
//
// PREČO TO EXISTUJE: appka sa šíri tým, že si ju tréneri posielajú medzi
// sebou — v správach na Instagrame, vo WhatsApp skupinách, mailom. Bez týchto
// značiek príde na druhú stranu holý modrý odkaz a nikto ho neotvorí.
// Na samotnom Instagrame to vidno menej (odkaz v bio otvorí prehliadač), ale
// preposielanie je práve ten kanál, ktorý pri tomto produkte rozhoduje.
//
// OBRÁZOK SA NEUKLADÁ AKO SÚBOR, KRESLÍ SA (`app/og/route.tsx`). Je to zámer:
// obrázkové logo sme 2026-09-24 z projektu vedome odstránili a nahradili
// textovou značkou, takže niet čo nahrať — a nakreslený obrázok sa navyše
// nikdy nerozíde s farbami v `globals.css` ani s textom v `messages/`.

import {
  APP_ORIGIN,
  PARENT_ORIGIN,
  PUBLIC_ORIGIN,
  SPORTS_HUB_ORIGIN,
  isFitnessHost,
  isParentFaceHost,
  isPublicFaceHost,
  isSportsHubHost,
} from "./public-face";

/** Štyri verejné tváre, každá s vlastnou farbou aj vlastnou vetou. */
export type OgFace = "coach" | "parent" | "org" | "fitness" | "hub";

/**
 * Farby sú OPÍSANÉ z `app/globals.css`, nie dopočítané — obrázok sa kreslí
 * mimo prehliadača, takže sa k CSS premenným nedostane. Keď sa tam paleta
 * zmení, zmeň ju aj tu; sú to jediné dve miesta.
 */
export const OG_FACE_STYLE: Record<
  OgFace,
  { background: string; accent: string; muted: string; domain: string }
> = {
  // Tenis: zelenočierne pozadie a limetková loptička.
  coach: {
    background: "#0e1411",
    accent: "#d3ee6c",
    muted: "#9ba59e",
    domain: "plaw.win",
  },
  parent: {
    background: "#0e1411",
    accent: "#d3ee6c",
    muted: "#9ba59e",
    domain: "plaw.click",
  },
  // Federácia a kondička si nechali tmavosivé plochy, s ktorými vznikli.
  org: {
    background: "#1e1e21",
    accent: "#6aa9dd",
    muted: "#a3a2aa",
    domain: "plaw.online",
  },
  fitness: {
    background: "#1e1e21",
    accent: "#20a99b",
    muted: "#a3a2aa",
    domain: "fitness.plawsports.com",
  },
  // Rozcestník športov nemá farbu žiadneho športu — neutrálna svetlá.
  hub: {
    background: "#1e1e21",
    accent: "#ededee",
    muted: "#a3a2aa",
    domain: "plawsports.com",
  },
};

/** Ktorá tvár beží na tomto hostiteľovi. Neznámy hostiteľ je tenisová appka. */
export function ogFaceOf(host: string | null | undefined): OgFace {
  if (isParentFaceHost(host)) return "parent";
  if (isPublicFaceHost(host)) return "org";
  if (isFitnessHost(host)) return "fitness";
  if (isSportsHubHost(host)) return "hub";
  return "coach";
}

/**
 * Adresa obrázka musí byť ABSOLÚTNA — čítačka náhľadu (WhatsApp, Messenger,
 * Instagram) si ju sťahuje sama a relatívnu cestu nemá voči čomu doplniť.
 *
 * Origin sa berie z kanonickej adresy tváre, nie z hostiteľa požiadavky:
 * odkaz sa môže zdieľať aj z `www.` podoby alebo z preview nasadenia a náhľad
 * má vždy ukazovať na to, kde stránka býva.
 */
export function ogImageUrl(face: OgFace) {
  const origin =
    face === "parent"
      ? PARENT_ORIGIN
      : face === "org"
        ? PUBLIC_ORIGIN
        : face === "fitness"
          ? "https://fitness.plawsports.com"
          : face === "hub"
            ? SPORTS_HUB_ORIGIN
            : APP_ORIGIN;
  return `${origin}/og?face=${face}`;
}

/**
 * Blok metadát pre náhľad odkazu. Vracia sa `openGraph` aj `twitter`, lebo
 * čítačky náhľadov sa nezhodujú: WhatsApp, Messenger a Instagram idú po
 * `og:*`, X ide po `twitter:*`, a kto nenájde svoje, neukáže nič.
 *
 * `title` a `description` sa berú z volajúceho, aby na karte bolo presne to,
 * čo má stránka v `<title>` — jedna pravda, nie dve.
 */
export function ogMetadata({
  face,
  title,
  description,
}: {
  face: OgFace;
  title: string;
  description: string;
}) {
  const image = {
    url: ogImageUrl(face),
    width: 1200,
    height: 630,
    alt: title,
  };
  return {
    openGraph: {
      type: "website" as const,
      siteName: "P.L.A.W",
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: [image.url],
    },
  };
}
