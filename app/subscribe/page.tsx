import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import { COACH_TIERS, formatEur } from "@/lib/landing-pricing";
import { coachProductId, priceLookupKey } from "@/lib/stripe-plans";
import { isStripeConfigured } from "@/lib/stripe";
import { PlanPicker, type PlanOption } from "./plan-picker";

// Výber cenovej hladiny a vstup do pokladne Stripe. Vedie sem tlačidlo
// z pruhu so stavom skúšobnej doby (`components/trial-banner.tsx`) — pruh sám
// hladinu vybrať nemôže, tréner má na výber tri.
//
// Sumy sa NEOPISUJÚ: berú sa z `lib/landing-pricing.ts`, teda z toho istého
// miesta ako cenník na verejnom webe, a `lookup_key` ceny sa skladá cez
// `lib/stripe-plans.ts`, ktorý používa aj zakladací skript. Ani cena, ani
// názov plánu sa teda nedajú rozísť medzi webom, appkou a Stripe.
export const metadata: Metadata = {
  title: "Subscribe — P.L.A.W",
  robots: { index: false, follow: false },
};

/** Adresa podpory pre existujúceho zákazníka — tá istá ako na `/settings`. */
const SUPPORT_EMAIL = "support@plawsports.com";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  // Kým nie sú nastavené kľúče (dnes stav produkcie), stránka NEEXISTUJE.
  // Tváriť sa, že vieme prijať platbu, a spadnúť až pri kliknutí, by bolo
  // horšie než nemať sem cestu vôbec.
  if (!isStripeConfigured()) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Predplatné je trénerský produkt; sledujúci má vlastnú cenu a vlastnú
  // stráž. Rovnaká podmienka je aj v samotnej akcii — toto je smerovanie,
  // hranicou je server action.
  if (profile?.role !== "coach") {
    redirect("/");
  }

  const subscription = await getSubscription(supabase, user.id);

  // Za federačného trénera platí organizácia faktúrou mimo appky (§5.9).
  if (subscription.coveredByOrganization) {
    redirect("/");
  }

  const t = await getTranslations("Subscribe");
  const { paid } = await searchParams;

  // Kto už platí, nemá vidieť ponuku znova. Server action by druhý nákup aj
  // tak odmietla (`alreadySubscribed`), ale ponúkať tlačidlo, ktoré skončí
  // chybou, je horšie než ho neponúkať — a po návrate z pokladne to pôsobilo,
  // akoby sa platba nestala (zistené pri prvej skutočnej testovacej platbe).
  const alreadyPaying = subscription.status === "active";

  const plans: PlanOption[] = COACH_TIERS.map((tier) => {
    const product = coachProductId(tier.players);
    return {
      players: tier.players,
      featured: Boolean(tier.featured),
      price: {
        month: formatEur(tier.monthly),
        year: formatEur(tier.yearly),
      },
      lookupKey: {
        month: priceLookupKey(product, "month"),
        year: priceLookupKey(product, "year"),
      },
    };
  });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-5 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
        {!alreadyPaying && <p className="text-sm text-muted">{t("intro")}</p>}
      </header>

      {paid === "1" && !alreadyPaying && (
        <div className="rounded-xl border border-emerald-500 bg-emerald-950 px-4 py-3 text-sm text-emerald-200">
          <p className="font-medium">{t("paidTitle")}</p>
          <p className="text-emerald-300">{t("paidText")}</p>
        </div>
      )}

      {alreadyPaying ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary bg-surface p-5">
          <p className="font-semibold text-foreground">{t("activeTitle")}</p>
          <p className="text-sm text-muted">
            {t("activeText", { count: subscription.playerLimit })}
          </p>
          {/* Zmena a zrušenie sú zatiaľ kontakt, nie tlačidlo — rovnako ako
              export dát na `/settings`. Tlačidlo z toho spraví až zákaznícky
              portál Stripe. */}
          <p className="text-sm text-muted">
            {t("activeChange", { email: SUPPORT_EMAIL })}
          </p>
        </div>
      ) : (
        <PlanPicker plans={plans} />
      )}

      <Link
        href="/"
        className="text-center text-sm text-muted underline underline-offset-2 transition-colors hover:text-foreground"
      >
        {t("back")}
      </Link>
    </div>
  );
}
