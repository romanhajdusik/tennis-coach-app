import type { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "./stripe";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * **Jediný zdroj pravdy o tom, či účet smie zapisovať.** Nikdy nerozhoduj
 * o predplatnom inde — ani „len na skrytie tlačidla" (rovnaký princíp ako
 * `getSelectedPlayer()` pri vybranom hráčovi).
 *
 * Model: 14 dní skúšobnej doby, potom platené. Po uplynutí účet **číta ďalej**
 * (história, hráči, kalendár), ale **nezapisuje** — o svoju prácu nepríde.
 * **Jedinou čítacou výnimkou je analytika**, ktorú cenník predáva ako platenú;
 * stráži ju `getPaidFeatureAccess` nižšie, nie `canWrite`.
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
  /**
   * Koľko hráčov smie mať účet naraz aktívnych (cenová hladina,
   * `profiles.player_limit`). Vo federačnom režime je bezvýznamné — počet
   * hráčov tam určuje priradenie od šéftrénera, nie predplatné, preto sa
   * pri `coveredByOrganization` na toto číslo nikto nepozerá.
   */
  playerLimit: number;
};

const NO_ACCESS: SubscriptionState = {
  canWrite: false,
  status: "unknown",
  trialEndsAt: null,
  onTrial: false,
  trialDaysLeft: null,
  coveredByOrganization: false,
  // Nula, nie „neobmedzene": keď o účte nič nevieme, nesmie pribudnúť hráč.
  playerLimit: 0,
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
    .select("subscription_status, trial_ends_at, player_limit")
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

  const playerLimit = profile.player_limit;

  if (PAID_STATUSES.has(status)) {
    return { ...NO_ACCESS, canWrite: true, status, trialEndsAt, playerLimit };
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
    playerLimit,
  };
}

/**
 * Dôvody, prečo účet nesmie zapisovať. Hodnoty sú zároveň **kľúče do
 * `Common`** — server action tak vráti `t(blocked)` a nemusí dôvody
 * prekladať sama; pri pribudnutí ďalšieho dôvodu sa nemusí obísť 14 miest.
 */
export const SUBSCRIPTION_REQUIRED = "subscriptionRequired";
export const PLAYER_LIMIT_EXCEEDED = "playerLimitExceeded";

export type WriteBlockReason =
  | typeof SUBSCRIPTION_REQUIRED
  | typeof PLAYER_LIMIT_EXCEEDED;

/** Koľko osobných hráčov má účet práve aktívnych. */
async function countActivePersonalPlayers(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", userId)
    .eq("is_active", true)
    .is("organization_id", null);

  return count ?? 0;
}

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
  options: { allowOverPlayerLimit?: boolean } = {},
): Promise<WriteBlockReason | null> {
  const { canWrite, coveredByOrganization, playerLimit } = await getSubscription(
    supabase,
    userId,
  );

  if (!canWrite) {
    return SUBSCRIPTION_REQUIRED;
  }

  // Za federačného trénera platí organizácia — cenová hladina sa naňho nevzťahuje.
  if (coveredByOrganization || options.allowOverPlayerLimit) {
    return null;
  }

  // Účet NAD zaplatenou hladinou nezapisuje, kým sa pod ňu sám nevráti
  // (rozhodnuté 2026-08-10). Vzniká to jediným spôsobom — znížením hladiny
  // účtu, ktorý už má viac hráčov; appka sama nikoho nearchivuje, lebo by
  // musela vybrať KTORÝCH hráčov tréner prestane trénovať.
  //
  // Ostro `>`: byť presne na hladine je v poriadku, blokuje až prekročenie.
  const active = await countActivePersonalPlayers(supabase, userId);
  return active > playerLimit ? PLAYER_LIMIT_EXCEEDED : null;
}

export type PlayerLimitState = {
  /** Koľko osobných hráčov je práve aktívnych. */
  active: number;
  /** Koľko ich hladina dovoľuje. */
  limit: number;
  /** Hladina je vyčerpaná — ďalší hráč už nepribudne. */
  reached: boolean;
  /** Hladina je PREKROČENÁ — účet dovtedy nezapisuje. */
  exceeded: boolean;
};

/**
 * Stav cenovej hladiny na zobrazenie (pruh, `/players`). `null` znamená
 * „netýka sa" — federačnému trénerovi počet hráčov určuje priradenie
 * od šéftrénera, nie predplatné.
 *
 * Rozdiel `reached` vs `exceeded` je zámerný a nikde inde sa nemá počítať
 * ručne: *vyčerpaná* hladina zabráni pridať ďalšieho hráča, *prekročená*
 * zastaví zápis úplne. Prekročiť sa dá len znížením hladiny účtu, ktorý už
 * hráčov má — appka sama nikoho nearchivuje.
 */
export async function getPlayerLimitState(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<PlayerLimitState | null> {
  const { coveredByOrganization, playerLimit } = await getSubscription(
    supabase,
    userId,
  );

  if (coveredByOrganization) {
    return null;
  }

  const active = await countActivePersonalPlayers(supabase, userId);

  return {
    active,
    limit: playerLimit,
    reached: active >= playerLimit,
    exceeded: active > playerLimit,
  };
}

/** Chyba, ktorú server action vráti, keď je cenová hladina vyčerpaná. */
export const PLAYER_LIMIT_REACHED = "player_limit_reached";

/**
 * **Jediný zdroj pravdy o tom, či smie pribudnúť ďalší aktívny hráč.**
 * Volá sa pri zakladaní hráča aj pri vrátení z archívu — obe cesty pridávajú
 * jedného aktívneho, takže obe musia cez túto stráž prejsť.
 *
 * Počítajú sa **len aktívni osobní hráči**: archív je uzavretá história a platiť
 * za ňu nedáva zmysel. Zníženie hladiny pod aktuálny počet nikoho nevyhodí, len
 * zabráni pridať ďalšieho — rovnako ako sedadlá vo federácii.
 *
 * **Prečo tu a nie v RLS:** rovnaká vedomá výnimka ako pri `requireWriteAccess`
 * — RLS stráži vlastníctvo, počet hráčov je obchodná podmienka. Zapísať ju do
 * policy by znamenalo poddotaz s počítaním v každej write policy na `players`.
 */
export async function requirePlayerSlot(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<typeof PLAYER_LIMIT_REACHED | null> {
  const { coveredByOrganization, playerLimit } = await getSubscription(
    supabase,
    userId,
  );

  // Federačný tréner nemá cenovú hladinu — koľko má hráčov, určuje priradenie
  // od šéftrénera a za sedadlo platí organizácia faktúrou mimo appky (§5.9).
  if (coveredByOrganization) {
    return null;
  }

  // `>=`, na rozdiel od `requireWriteAccess`: tam ide o to, či účet hladinu už
  // PREKROČIL, tu o to, či by ju pridanie ďalšieho prekročilo.
  const active = await countActivePersonalPlayers(supabase, userId);
  return active >= playerLimit ? PLAYER_LIMIT_REACHED : null;
}

/**
 * Má účet otvorené platené časti, ktoré sa len **čítajú**?
 *
 * Dve miesta, jedna podmienka — obe sľubuje cenník na verejnom webe:
 * - **sledujúci** (rodič, manažér, hráč): kalendár a analytika
 *   (`docs/cennik-navrh.md` §8.3, tabuľka „Bez predplatného");
 * - **tréner**: analytika (`pricingCompareRows` v `messages/en/landing.json`,
 *   pole `WITHOUT_SUBSCRIPTION` v `components/landing-pricing.tsx`).
 *
 * **Je to tá istá podmienka ako `canWrite`, ale iný význam.** Sledujúci
 * nikdy nič nezapisuje a tréner si analytiku nekupuje preto, aby do nej
 * písal — v oboch prípadoch tým istým stavom účtu riadime ČÍTANIE. Preto
 * vlastná funkcia a nie `canWrite` priamo: volajúci by pri čítaní nemal
 * pýtať právo na zápis a čitateľ kódu by hádal, či to nie je omyl.
 *
 * **Trénerovi sa tým zamyká JEDINE analytika.** Zoznam tréningov, detail,
 * kalendár, hráči aj vlastné kódy cvičení ostávajú otvorené — paywall nesmie
 * pôsobiť ako zabavenie dát (CLAUDE.md, „Skúšobná doba a predplatné").
 *
 * Trial platí aj tu — cenník sľubuje „prvých 14 dní na vyskúšanie, potom sa
 * platí" a `profiles.trial_ends_at` má každý účet bez rozdielu roly.
 * Federačného trénera drží nad vodou `coveredByOrganization` v
 * `getSubscription`: za sedadlo platí organizácia faktúrou.
 *
 * **BEZ NAPOJENÉHO STRIPE JE VŠETKO OTVORENÉ, a to je zámer.** Keby stráže
 * platili aj tam, kde sa zaplatiť NEDÁ, vzali by sme ľuďom kalendár bez toho,
 * aby mali ako ho získať späť. Rovnaký princíp ako na stránke pokladne, ktorá
 * sa bez kľúčov tvári, že neexistuje.
 */
export async function getPaidFeatureAccess(
  supabase: SupabaseServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<{
  unlocked: boolean;
  onTrial: boolean;
  trialDaysLeft: number | null;
}> {
  if (!isStripeConfigured()) {
    return { unlocked: true, onTrial: false, trialDaysLeft: null };
  }

  const subscription = await getSubscription(supabase, userId, now);
  return {
    unlocked: subscription.canWrite,
    onTrial: subscription.onTrial,
    trialDaysLeft: subscription.trialDaysLeft,
  };
}
