import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * **Jediný zdroj pravdy o tom, či účet smie zapisovať.** Nikdy nerozhoduj
 * o predplatnom inde — ani „len na skrytie tlačidla" (rovnaký princíp ako
 * `getSelectedPlayer()` pri vybranom hráčovi).
 *
 * Model: 14 dní skúšobnej doby, potom platené. Po uplynutí účet **číta ďalej**
 * (história, analytika, hráči), ale **nezapisuje** — o svoju prácu nepríde.
 *
 * Federačný tréner sa paywallu netýka: organizácia platí faktúrou za sedadlá
 * (§5.9), takže jej zamestnancovi nemá čo blokovať osobné predplatné.
 */

/** Stavy, pri ktorých účet platí (alebo mu prístup dávame my). */
const PAID_STATUSES = new Set(["active", "complimentary"]);

export type SubscriptionState = {
  /** Smie účet zapisovať? */
  canWrite: boolean;
  status: string;
  trialEndsAt: Date | null;
  /** Beží skúšobná doba (nie platené predplatné)? */
  onTrial: boolean;
  /** Zostávajúce celé dni skúšobnej doby; `null`, keď o trial nejde. */
  trialDaysLeft: number | null;
  /** Platí za neho organizácia (federačný režim)? */
  coveredByOrganization: boolean;
};

const NO_ACCESS: SubscriptionState = {
  canWrite: false,
  status: "unknown",
  trialEndsAt: null,
  onTrial: false,
  trialDaysLeft: null,
  coveredByOrganization: false,
};

export async function getSubscription(
  supabase: SupabaseServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionState> {
  // Členstvo v organizácii prebíja všetko ostatné — platí zaň federácia.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    return { ...NO_ACCESS, canWrite: true, status: "organization", coveredByOrganization: true };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", userId)
    .maybeSingle();

  // Profil chýba len pri rozbitom účte — radšej nezapisovať než tichom pustiť.
  if (!profile) {
    return NO_ACCESS;
  }

  const status = profile.subscription_status;
  const trialEndsAt = profile.trial_ends_at
    ? new Date(profile.trial_ends_at)
    : null;

  if (PAID_STATUSES.has(status)) {
    return { ...NO_ACCESS, canWrite: true, status, trialEndsAt };
  }

  const trialRunning =
    status === "trial" && trialEndsAt !== null && trialEndsAt > now;

  return {
    canWrite: trialRunning,
    status,
    trialEndsAt,
    onTrial: trialRunning,
    // Zaokrúhľuje sa nahor: posledný načatý deň je stále „1 deň zostáva",
    // nie „0" — nula pôsobí, akoby už bolo po skúšobnej dobe.
    trialDaysLeft: trialRunning
      ? Math.max(
          1,
          Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000),
        )
      : null,
    coveredByOrganization: false,
  };
}

/** Chyba, ktorú server action vráti, keď je predplatné neaktívne. */
export const SUBSCRIPTION_REQUIRED = "subscription_required";

/**
 * Stráž pre zapisovacie server actions. Vracia `null`, keď je všetko v poriadku,
 * inak dôvod zamietnutia.
 *
 * **Prečo tu a nie v RLS:** hranicou DÁT ostáva RLS (cudzí riadok nevydá nikomu),
 * ale predplatné je obchodná podmienka, nie vlastníctvo. Vpísať ho do policy by
 * znamenalo pridať ďalšiu podmienku do každej write policy na players/sessions/
 * session_drills — a tie sú overené 32 RLS scenármi. Zápisy appky idú výhradne
 * cez server actions, takže táto stráž je serverová hranica, nie skrytie tlačidla.
 */
export async function requireWriteAccess(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<typeof SUBSCRIPTION_REQUIRED | null> {
  const { canWrite } = await getSubscription(supabase, userId);
  return canWrite ? null : SUBSCRIPTION_REQUIRED;
}
