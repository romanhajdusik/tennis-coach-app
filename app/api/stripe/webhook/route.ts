import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { verifyWebhookEvent } from "@/lib/stripe";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

/**
 * Stripe webhook — **jediné miesto, kde sa do appky dostane informácia
 * o zaplatení.**
 *
 * Prečo vôbec existuje: zákazník môže po platbe zavrieť prehliadač a návrat
 * na `/subscribe?paid=1` sa nikdy nestane. Jediný spoľahlivý zdroj pravdy je
 * teda udalosť, ktorú Stripe pošle sem.
 *
 * **Sú tu tri veci naraz, ktoré nikde inde v appke nie sú:**
 *
 * 1. **Verejná adresa bez prihlásenia, ktorá ZAPISUJE.** Preto sa každá
 *    požiadavka najprv overuje podpisom (`verifyWebhookEvent`) a bez neho sa
 *    nespracuje nič. Overuje sa PRED čítaním obsahu.
 * 2. **`service_role` kľúč.** Do `profiles` nesmie zapisovať ani prihlásený
 *    účet (inak by si sám nastavil „zaplatené"), takže to musí spraviť server.
 *    Klient je v `lib/supabase/admin.ts` a inde sa nepoužíva.
 * 3. **Telo sa číta ako surový text.** Podpis sa počíta z bajtov tak, ako
 *    prišli — `request.json()` by ho znehodnotil.
 *
 * **Odpovede sú zámerne strohé.** Stripe nezaujíma, čo sa stalo, a útočník
 * sa z odpovede nemá dozvedieť nič. Neúspešné overenie je 400, spracovaná aj
 * ignorovaná udalosť je 200. **200 pri ignorovanej udalosti je dôležité** —
 * čokoľvek iné si Stripe vyloží ako chybu a bude to skúšať znova dokola.
 */

// Potrebujeme surové telo a Node crypto — nie edge runtime.
export const runtime = "nodejs";

/**
 * Preklad stavu predplatného Stripe na náš slovník
 * (`lib/subscription.ts#PAID_STATUSES`).
 *
 * `null` znamená „nevieme, nechaj tak" — napríklad `incomplete` je platba
 * rozpracovaná, nie zaplatená, a prepísať ňou stav účtu by bola chyba oboma
 * smermi. `trialing` je zaplatené: skúšobnú dobu cez Stripe dnes nedávame,
 * ale keby raz áno, prístup má fungovať.
 */
function mapStatus(stripeStatus: string): string | null {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") {
    return "canceled";
  }
  return null;
}

type Outcome = { userId: string; status: string; playerLimit?: number } | null;

/** Metadáta nesie platba aj predplatné — obe sa im nastavujú pri pokladni. */
function readMeta(metadata: Stripe.Metadata | null | undefined) {
  const userId = metadata?.plaw_user_id;
  const limit = Number(metadata?.plaw_player_limit);
  return {
    userId: typeof userId === "string" && userId ? userId : null,
    // Hladinu berieme, len keď je to rozumné číslo. Nula alebo NaN by účtu
    // zobrala všetkých hráčov, hoci práve zaplatil.
    playerLimit: Number.isInteger(limit) && limit > 0 ? limit : undefined,
  };
}

function outcomeFor(event: Stripe.Event): Outcome {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, playerLimit } = readMeta(session.metadata);
    // `client_reference_id` je záloha pre prípad, že by metadáta chýbali.
    const id = userId ?? session.client_reference_id;
    if (!id) return null;
    // Predplatné so skúšobnou dobou má `payment_status = "no_payment_required"`
    // — je to platná objednávka, len sa zatiaľ nestrhlo.
    if (session.payment_status === "unpaid") return null;
    return { userId: id, status: "active", playerLimit };
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const { userId, playerLimit } = readMeta(subscription.metadata);
    if (!userId) return null;

    const status =
      event.type === "customer.subscription.deleted"
        ? "canceled"
        : mapStatus(subscription.status);

    if (!status) return null;

    // Pri zrušení sa hladina NEMENÍ. Účet prestane zapisovať aj tak
    // (`requireWriteAccess`), ale zrazením hladiny na nulu by sa dostal do
    // stavu „prekročená hladina" a po opätovnom zaplatení by mu appka
    // povedala, nech archivuje deti. To je zlá odpoveď na zaplatenie.
    return status === "canceled"
      ? { userId, status }
      : { userId, status, playerLimit };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new NextResponse("missing signature", { status: 400 });
  }

  if (!hasServiceRoleKey()) {
    // Bez kľúča by sme udalosť prijali a ticho zahodili — tréner by zaplatil
    // a nikdy sa nedozvedel prečo sa nič nestalo. Nech to Stripe radšej skúša
    // znova a nech je to vidieť v jeho prehľade udalostí.
    console.error("Stripe webhook: SUPABASE_SERVICE_ROLE_KEY chýba");
    return new NextResponse("not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    // Surové telo, nie `request.json()` — podpis sa počíta z bajtov.
    event = await verifyWebhookEvent(await request.text(), signature);
  } catch (error) {
    // Do logu ide dôvod, do odpovede nie: je to verejná adresa.
    console.error("Stripe webhook: podpis neprešiel", error);
    return new NextResponse("bad signature", { status: 400 });
  }

  const outcome = outcomeFor(event);

  // Udalosť, ktorú nesledujeme, je v poriadku — Stripe ich posiela veľa.
  if (!outcome) {
    return NextResponse.json({ ignored: event.type });
  }

  const update: { subscription_status: string; player_limit?: number } = {
    subscription_status: outcome.status,
  };
  if (outcome.playerLimit !== undefined) {
    update.player_limit = outcome.playerLimit;
  }

  const { error } = await createAdminClient()
    .from("profiles")
    .update(update)
    .eq("id", outcome.userId);

  if (error) {
    // 500 je tu správna odpoveď: Stripe udalosť doručí znova, takže sa
    // výpadok databázy sám dorovná. 200 by platbu stratilo nadobro.
    console.error(`Stripe webhook: zápis zlyhal (${event.type})`, error);
    return new NextResponse("write failed", { status: 500 });
  }

  return NextResponse.json({ handled: event.type });
}
