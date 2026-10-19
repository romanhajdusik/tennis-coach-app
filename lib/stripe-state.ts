import { playerLimitOfLookupKey } from "@/lib/stripe-plans";
import { COACH_TIERS } from "@/lib/landing-pricing";

/**
 * Stav účtu odvodený zo VŠETKÝCH predplatných zákazníka v Stripe — nie z jednej
 * udalosti (previerka po Stripe, 2026-10-19, nálezy S1 a S2).
 *
 * **Prečo nestačí udalosť samotná:**
 *
 * - **S1 — viac predplatných jedného účtu.** Zrušenie STARÉHO predplatného
 *   (napr. po neprejdenej karte) by zapísalo „canceled" účtu, ktorý medzitým
 *   platí NOVÉ. Udalosť hovorí len o jednom predplatnom, stav účtu je súhrn.
 * - **S2 — poradie udalostí.** Stripe nezaručuje, že udalosti prídu v poradí,
 *   v akom vznikli, a neúspešné doručenie opakuje aj o hodiny neskôr. Oneskorené
 *   „active" po „deleted" by vrátilo prístup zadarmo. Stav prečítaný zo Stripe
 *   v čase spracovania je vždy aktuálny, nech príde ktorákoľvek udalosť.
 *
 * Funkcia je čistá (bez siete), aby sa dala čítať a overiť zvlášť.
 */

export type StripeSubscriptionLite = {
  id: string;
  status: string;
  created: number;
  metadata?: Record<string, string> | null;
  items?: { data?: { price?: { lookup_key?: string | null } | null }[] } | null;
};

export type DerivedState = {
  status: "active" | "past_due" | "canceled";
  /** Len pri `active` — pri ostatných sa hladina nemení (viď webhook). */
  playerLimit?: number;
};

/** Predplatné, ktoré ešte BEŽÍ — za také sa druhé kupovať nesmie. */
export const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

function limitOf(subscription: StripeSubscriptionLite) {
  const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
  const fromPrice = lookupKey
    ? playerLimitOfLookupKey(
        lookupKey,
        COACH_TIERS.map((tier) => tier.players),
      )
    : null;
  if (fromPrice !== null) return fromPrice;
  const fromMeta = Number(subscription.metadata?.plaw_player_limit);
  return Number.isInteger(fromMeta) && fromMeta > 0 ? fromMeta : undefined;
}

/**
 * Vráti stav účtu `userId` zo zoznamu predplatných jeho zákazníka, alebo
 * `null`, keď v zozname nie je ani jedno predplatné tohto účtu (vtedy webhook
 * nevie nič lepšie než udalosť samotná).
 *
 * Poradie dôležitosti: niečo platené (`active`/`trialing`) → `active`;
 * inak niečo s dlhom (`past_due`/`unpaid`) → `past_due`; inak `canceled`.
 * `incomplete` sa nepočíta — je to rozpracovaná platba, nie zaplatené.
 */
export function deriveAccountState(
  subscriptions: readonly StripeSubscriptionLite[],
  userId: string,
): DerivedState | null {
  const mine = subscriptions.filter(
    (subscription) => subscription.metadata?.plaw_user_id === userId,
  );
  if (mine.length === 0) return null;

  // Najnovšie prvé: pri dvoch platených rozhoduje to, ktoré vzniklo neskôr
  // (typicky zmena hladiny cez novú pokladňu pred zavedením tejto stráže).
  const newestFirst = [...mine].sort((a, b) => b.created - a.created);

  const paid = newestFirst.find(
    (subscription) =>
      subscription.status === "active" || subscription.status === "trialing",
  );
  if (paid) return { status: "active", playerLimit: limitOf(paid) };

  const owing = newestFirst.some(
    (subscription) =>
      subscription.status === "past_due" || subscription.status === "unpaid",
  );
  if (owing) return { status: "past_due" };

  // Ostali len skončené (`canceled`, `incomplete_expired`) alebo rozpracované
  // (`incomplete`). Rozpracované samo o sebe nič nemení — keď je okrem neho
  // všetko skončené, účet neplatí.
  const onlyIncomplete = newestFirst.every(
    (subscription) => subscription.status === "incomplete",
  );
  return onlyIncomplete ? null : { status: "canceled" };
}
