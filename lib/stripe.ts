/**
 * Tenká vrstva nad Stripe API. **Beží výhradne na serveri** — drží tajný kľúč,
 * takže sa nesmie importovať z komponentu s `"use client"`.
 *
 * Zámerne bez balíčka `stripe`: pokladňa potrebuje dve volania a tie sa dajú
 * spraviť obyčajným `fetch`om. Keby raz pribudol webhook, ktorý overuje podpis,
 * knižnica sa oplatí — a zmení sa vtedy **len tento súbor**, nič nad ním.
 */

// Bez pevnej verzie by sa správanie appky menilo pod rukami vždy, keď Stripe
// vydá novú. Rovnaká hodnota je v `scripts/stripe/setup-products.js` — dvíha
// sa vedome a na oboch miestach naraz.
const STRIPE_API_VERSION = "2025-08-27.basil";

/**
 * Je Stripe vôbec nastavený? **Na produkcii dnes NIE** a je to zámer: kým tam
 * kľúče nepribudnú, appka sa nesmie tváriť, že vie prijať platbu. Preto sa
 * podľa toho skrýva tlačidlo aj celá stránka `/subscribe` — mŕtve tlačidlo,
 * ktoré vyhodí chybu až po kliknutí, je horšie než žiadne.
 */
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY nie je nastavený");
  return key;
}

/** Stripe API neberie JSON, len form-encoded telo s plochými kľúčmi. */
function encodeForm(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function stripeRequest(
  method: "GET" | "POST",
  endpoint: string,
  params?: Record<string, string>,
) {
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: params ? encodeForm(params) : undefined,
    // Platba nesmie visieť na Next cache — ide o jednorazovú operáciu.
    cache: "no-store",
  });

  const body = await response.json();

  if (!response.ok) {
    // Hlášku Stripe berieme do LOGU, nie do odpovede používateľovi: vie
    // obsahovať identifikátory účtu a nič mu nepovie.
    throw new Error(
      `Stripe ${method} ${endpoint} → ${response.status}: ${
        body?.error?.message ?? "neznáma chyba"
      }`,
    );
  }

  return body;
}

/**
 * Nájde cenu podľa `lookup_key`. Ceny sa hľadajú takto, a nie podľa `price_…`
 * zapísaného v kóde: identifikátory sú v testovacej a ostrej polovici účtu
 * INÉ, takže by sa appka v deň spustenia pýtala na neexistujúcu cenu.
 */
export async function findPriceIdByLookupKey(lookupKey: string) {
  const found = await stripeRequest(
    "GET",
    `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1&active=true`,
  );
  return (found.data?.[0]?.id as string | undefined) ?? null;
}

export type CheckoutSessionInput = {
  priceId: string;
  /** Účet, ktorému predplatné patrí — podľa neho ho neskôr priradí webhook. */
  userId: string;
  customerEmail: string | undefined;
  successUrl: string;
  cancelUrl: string;
  /**
   * Koľko hráčov hladina dovoľuje. Ide do metadát, aby ho webhook **nemusel
   * doťahovať zo Stripe** — stačí mu udalosť, ktorá príde. Číslo pritom
   * nevzniká tu: berie sa z `lib/landing-pricing.ts`, teda z toho istého
   * zdroja ako cena na webe a ako metadáta produktu, ktoré zakladá
   * `scripts/stripe/setup-products.js`.
   *
   * **Sledujuci ju NEMA** a je preto nepovinna: sleduje vzdy jedneho hraca,
   * takze mu ziadna hladina neprislucha. Webhook `player_limit` zapise len
   * vtedy, ked v metadatach naozaj je (`readMeta` v jeho route).
   */
  playerLimit?: number;
  /**
   * Co sa predava. Ide do metadat, aby bolo priamo v Stripe vidiet, ci
   * platba patri trenerovi alebo sledujucemu — bez dohladavania v nasej DB.
   */
  role: "coach" | "follower";
};

/**
 * Založí platobnú stránku Stripe a vráti adresu, na ktorú sa má prehliadač
 * presmerovať.
 *
 * `client_reference_id` a metadáta nesú `userId` zámerne dvakrát — na samotnej
 * platbe aj na vzniknutom predplatnom. Webhook potom nemusí dohľadávať, komu
 * platba patrí: účet mu príde priamo v udalosti.
 */
export async function createCheckoutSession({
  priceId,
  userId,
  customerEmail,
  successUrl,
  cancelUrl,
  playerLimit,
  role,
}: CheckoutSessionInput) {
  // Tie isté metadáta sa píšu na platbu AJ na vzniknuté predplatné. Nie je to
  // duplicita pre istotu: `checkout.session.completed` nesie metadáta platby,
  // kým neskoršie udalosti (zmena plánu, zrušenie) nesú metadáta predplatného.
  // Bez oboch by webhook pri niektorej udalosti nevedel, komu patrí.
  const meta = {
    plaw_user_id: userId,
    plaw_role: role,
    ...(playerLimit === undefined
      ? {}
      : { plaw_player_limit: String(playerLimit) }),
  };

  const session = await stripeRequest("POST", "/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    ...Object.fromEntries(
      Object.entries(meta).flatMap(([key, value]) => [
        [`metadata[${key}]`, value],
        [`subscription_data[metadata][${key}]`, value],
      ]),
    ),
    ...(customerEmail ? { customer_email: customerEmail } : {}),
  });

  return session.url as string;
}

/**
 * Zákaznícky portál Stripe — hotová stránka, kde si zákazník **sám** zmení
 * kartu, prejde na inú hladinu alebo predplatné **zruší**.
 *
 * Je to jediná rozumná odpoveď na „ako predplatné zrušim": ukončiť zmluvu má
 * byť rovnako jednoduché ako ju uzavrieť, a odkazovať pritom na e-mail podpory
 * je slabá náhrada. Nič z toho nepíšeme sami — Stripe to má hotové, my robíme
 * len dvere.
 *
 * Relácia platí krátko a je jednorazová, takže sa adresa nedá uložiť do
 * záložiek ani poslať ďalej.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
) {
  const session = await stripeRequest("POST", "/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url as string;
}

/**
 * Overenie podpisu Stripe na prichádzajúcej udalosti.
 *
 * **Toto je bezpečnostná hranica webhooku.** Je to verejná adresa bez
 * prihlásenia, ktorá zapisuje do databázy — bez overenia podpisu by si
 * ktokoľvek nastavil „zaplatené" tým, že na ňu pošle vymyslenú správu.
 *
 * Používa oficiálnu knižnicu, nie vlastný HMAC: overenie rieši aj **ochranu
 * proti opakovaniu** (odmietne starú časovú pečiatku) a **porovnanie odolné
 * voči meraniu času**. Vlastnoručný podpis je presne ten druh kódu, kde sa
 * chyba nedá odhaliť testom správnej cesty.
 *
 * Telo musí byť **surový text**, nie prečítaný JSON — podpis sa počíta
 * z bajtov tak, ako prišli.
 */
export async function verifyWebhookEvent(rawBody: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET nie je nastavený");

  const { default: Stripe } = await import("stripe");
  // Verzia API sa tu ZÁMERNE nenastavuje. Cez tohto klienta nerobíme ani jedno
  // volanie — slúži výhradne na overenie podpisu, a to od verzie nezávisí.
  // Naše skutočné volania idú `fetch`om s pevnou `STRIPE_API_VERSION` vyššie.
  const stripe = new Stripe(secretKey());

  return stripe.webhooks.constructEventAsync(rawBody, signature, secret);
}
