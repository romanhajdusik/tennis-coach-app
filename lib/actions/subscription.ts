"use server";

import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/request-origin";
import { getSubscription } from "@/lib/subscription";
import { COACH_TIERS } from "@/lib/landing-pricing";
import {
  isFollowerLookupKey,
  isKnownCoachLookupKey,
} from "@/lib/stripe-plans";
import {
  createCheckoutSession,
  createPortalSession,
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

  // Dva rôzne produkty za jednou akciou. Rozhoduje ROLA ÚČTU, nie to, čo
  // poslal prehliadač — inak by si sledujúci kúpil trénerskú hladinu (lacnejšie
  // za viac) alebo naopak. Kľúč z prehliadača sa preto overuje proti zoznamu
  // TEJ roly, ktorú má účet naozaj.
  const isCoach = profile?.role === "coach";
  const isFollower =
    profile?.role === "parent" ||
    profile?.role === "manager" ||
    profile?.role === "player";

  if (!isCoach && !isFollower) {
    return { error: "notForThisAccount" };
  }

  const subscription = await getSubscription(supabase, user.id);

  // Za federačného trénera platí organizácia faktúrou mimo appky (§5.9).
  // Keby si predplatné kúpil sám, platil by dvakrát za to isté. Sledujúceho
  // sa to netýka — ten do organizácie nepatrí.
  if (isCoach && subscription.coveredByOrganization) {
    return { error: "notForThisAccount" };
  }

  // `complimentary` sa zámerne PÚŠŤA — je to prístup zadarmo od nás a účet
  // má právo prejsť na platený. Blokuje sa len ten, kto už platí.
  if (subscription.status === "active") {
    return { error: "alreadySubscribed" };
  }

  // Hladinu má len tréner. Sledujúci sleduje vždy jedného hráča, takže mu
  // žiadna neprislúcha a do metadát sa nedostane (viď `CheckoutSessionInput`).
  let playerLimit: number | undefined;

  if (isCoach) {
    const tier = COACH_TIERS.find((candidate) =>
      isKnownCoachLookupKey(lookupKey, [candidate.players]),
    );
    if (!tier) {
      return { error: "unknownPlan" };
    }
    playerLimit = tier.players;
  } else if (!isFollowerLookupKey(lookupKey)) {
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

  // Sledujúci žije na `/parent`, tréner na `/subscribe`. Vrátiť rodiča do
  // trénerskej časti by znamenalo, že po zaplatení skončí na stránke, na
  // ktorú nemá prístup.
  const back = isCoach ? "/subscribe" : "/parent/subscribe";

  try {
    const url = await createCheckoutSession({
      priceId,
      userId: user.id,
      customerEmail: user.email,
      successUrl: `${origin}${back}?paid=1`,
      cancelUrl: `${origin}${back}`,
      playerLimit,
      role: isCoach ? "coach" : "follower",
    });
    return { url };
  } catch (error) {
    // Hláška Stripe môže niesť identifikátory účtu — patrí do logu, nie
    // na obrazovku.
    console.error("Stripe checkout zlyhal:", error);
    return { error: "unavailable" };
  }
}

/**
 * Otvorenie zákazníckeho portálu Stripe.
 *
 * Tu si tréner **sám** zmení kartu, prejde na inú hladinu alebo predplatné
 * **zruší**. Do 2026-09-28 mu appka na to ponúkala len e-mail na podporu, čo
 * bola zlá odpoveď: ukončiť zmluvu má byť rovnako jednoduché ako ju uzavrieť.
 *
 * **Vracia adresu, nepresmerúva sama** — z rovnakého dôvodu ako
 * `startCheckout` (viď tam).
 *
 * `stripe_customer_id` zapisuje výhradne webhook, takže si ho volajúci nemôže
 * podvrhnúť; akcia si ho navyše číta z **vlastného** riadku (RLS `id =
 * auth.uid()`), teda cudzí portál sa otvoriť nedá.
 */
export async function openBillingPortal(): Promise<
  { url: string } | { error: string }
> {
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
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  // Kto cez Stripe nikdy neplatil, nemá čo spravovať — napríklad účet
  // s prístupom zadarmo od nás (`complimentary`).
  if (!profile?.stripe_customer_id) {
    return { error: "noSubscription" };
  }

  const origin = await requestOrigin();

  try {
    const url = await createPortalSession(
      profile.stripe_customer_id,
      `${origin}/settings`,
    );
    return { url };
  } catch (error) {
    console.error("Stripe portál zlyhal:", error);
    return { error: "unavailable" };
  }
}
