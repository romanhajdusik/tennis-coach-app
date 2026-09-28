"use server";

import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/request-origin";
import { getSubscription } from "@/lib/subscription";
import { COACH_TIERS } from "@/lib/landing-pricing";
import { isKnownCoachLookupKey } from "@/lib/stripe-plans";
import {
  createCheckoutSession,
  findPriceIdByLookupKey,
  isStripeConfigured,
} from "@/lib/stripe";

/**
 * Otvorenie platobnej stránky Stripe pre trénera.
 *
 * **Vracia adresu, nepresmerúva sama** — rovnaký dôvod ako pri `login()`
 * (CLAUDE.md, „Disciplína"): `redirect()` zo server action vybaví Next
 * internou požiadavkou servera, nie požiadavkou prehliadača. Formulár preto
 * cieľ otvorí úplným načítaním a Stripe dostane skutočnú návštevu.
 *
 * Kto smie platiť, rozhoduje SERVER. Prehliadač posiela len `lookup_key`
 * ceny a ten sa overuje proti zoznamu hladín — inak by si ktokoľvek poslal
 * ľubovoľný kľúč z účtu.
 */
export async function startCheckout(
  lookupKey: string,
): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) {
    return { error: "unavailable" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Predplatné je trénerský produkt. Sledujúci má vlastnú cenu a vlastnú
  // stráž (na ČÍTANIE, nie na zápis) — tá sa rieši samostatne.
  if (profile?.role !== "coach") {
    return { error: "notForThisAccount" };
  }

  const subscription = await getSubscription(supabase, user.id);

  // Za federačného trénera platí organizácia faktúrou mimo appky (§5.9).
  // Keby si predplatné kúpil sám, platil by dvakrát za to isté.
  if (subscription.coveredByOrganization) {
    return { error: "notForThisAccount" };
  }

  // `complimentary` sa zámerne PÚŠŤA — je to prístup zadarmo od nás a účet
  // má právo prejsť na platený. Blokuje sa len ten, kto už platí.
  if (subscription.status === "active") {
    return { error: "alreadySubscribed" };
  }

  const tier = COACH_TIERS.find((candidate) =>
    isKnownCoachLookupKey(lookupKey, [candidate.players]),
  );

  if (!tier) {
    return { error: "unknownPlan" };
  }

  const priceId = await findPriceIdByLookupKey(lookupKey);

  if (!priceId) {
    // Cena v Stripe chýba — buď nebehol `scripts/stripe/setup-products.js`,
    // alebo sa zmenil cenník a stará cena sa archivovala.
    console.error(`Stripe: cena ${lookupKey} v účte neexistuje`);
    return { error: "unavailable" };
  }

  // Adresa sa skladá z hlavičky `Host`, nikdy natvrdo — appka beží na
  // viacerých hostoch a pevná adresa by trénera po platbe vrátila inam,
  // než odkiaľ odišiel (a cookies sú host-only, takže odhlásená).
  const origin = await requestOrigin();

  try {
    const url = await createCheckoutSession({
      priceId,
      userId: user.id,
      customerEmail: user.email,
      successUrl: `${origin}/subscribe?paid=1`,
      cancelUrl: `${origin}/subscribe`,
      // Hladinu nesie platba v metadátach, aby ju webhook nemusel doťahovať
      // späť zo Stripe. Číslo je z `COACH_TIERS`, teda z rovnakého zdroja ako
      // cena — nie z toho, čo poslal prehliadač.
      playerLimit: tier.players,
    });
    return { url };
  } catch (error) {
    // Hláška Stripe môže niesť identifikátory účtu — patrí do logu, nie
    // na obrazovku.
    console.error("Stripe checkout zlyhal:", error);
    return { error: "unavailable" };
  }
}
