import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getPlayerLimitState, getSubscription } from "@/lib/subscription";

/**
 * Pruh so stavom skúšobnej doby. Vykreslí sa **len trénerovi, ktorého sa
 * paywall naozaj týka** — rodič/hráč majú prístup zadarmo a za federačného
 * trénera platí organizácia faktúrou.
 *
 * Zámerne mlčí, kým je predplatné v poriadku (`active`/`complimentary`)
 * a kým do konca skúšobnej doby ostáva viac než týždeň — inak by to bola
 * len otravná lišta na každej obrazovke.
 *
 * Tlačidlo „Predplatiť" tu zatiaľ nie je: Stripe ešte nie je napojený a mŕtve
 * tlačidlo je horšie než žiadne. Pribudne sem, keď bude kam viesť.
 */
const WARN_WHEN_DAYS_LEFT_BELOW = 8;

export async function TrialBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "coach") return null;

  const subscription = await getSubscription(supabase, user.id);

  if (subscription.coveredByOrganization) return null;

  const t = await getTranslations("Common.trial");

  if (!subscription.canWrite) {
    return (
      <div className="w-full bg-red-950 px-4 py-2.5 text-center text-sm text-red-200">
        <span className="font-medium">{t("endedTitle")}</span>{" "}
        <span className="text-red-300">{t("endedText")}</span>
      </div>
    );
  }

  // Účet nad zaplatenou hladinou nezapisuje, kým sa pod ňu sám nevráti. Pruh
  // musí povedať PRESNE koľko hráčov ubrať — inak tréner len narazí na tichú
  // stenu a nevie, čo s tým. Rovnaký červený pruh ako po skúšobnej dobe:
  // z pohľadu trénera je následok ten istý (appka neprijme zápis).
  const limitState = await getPlayerLimitState(supabase, user.id);

  if (limitState?.exceeded) {
    const tLimit = await getTranslations("Common.playerLimit");
    return (
      <div className="w-full bg-red-950 px-4 py-2.5 text-center text-sm text-red-200">
        <span className="font-medium">
          {tLimit("exceededTitle", {
            count: limitState.active,
            limit: limitState.limit,
          })}
        </span>{" "}
        <span className="text-red-300">
          {tLimit("exceededText", {
            excess: limitState.active - limitState.limit,
          })}
        </span>
      </div>
    );
  }

  const daysLeft = subscription.trialDaysLeft;

  if (daysLeft === null || daysLeft >= WARN_WHEN_DAYS_LEFT_BELOW) return null;

  return (
    <div className="w-full bg-surface px-4 py-2 text-center text-sm text-muted">
      {t("daysLeft", { days: daysLeft })}
    </div>
  );
}
