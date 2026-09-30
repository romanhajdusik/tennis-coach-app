import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/subscription";
import {
  FOLLOWER_PRICE,
  centsPerPlayerDay,
  formatEur,
} from "@/lib/landing-pricing";
import { FOLLOWER_PRODUCT_ID, priceLookupKey } from "@/lib/stripe-plans";
import { isStripeConfigured } from "@/lib/stripe";
import { FollowerPlanPicker } from "./follower-plan";

// Pokladňa pre sledujúceho (rodič, manažér, hráč). Je to VLASTNÁ stránka,
// nie `/subscribe` s vetvením: tréner si vyberá hladinu, sledujúci len obdobie,
// a `/subscribe` je navyše v trénerskej časti appky, kam sa sledujúci nedostane.
//
// Sumy sa NEOPISUJÚ — berú sa z `lib/landing-pricing.ts`, teda z toho istého
// miesta ako cenník na `plaw.click`, a `lookup_key` sa skladá cez
// `lib/stripe-plans.ts`, ktorý používa aj zakladací skript. Cena na webe,
// v appke a v Stripe sa tak nedajú rozísť.
export const metadata: Metadata = {
  title: "Subscribe — P.L.A.W",
  robots: { index: false, follow: false },
};

export default async function ParentSubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  // Kým nie sú nastavené kľúče, stránka NEEXISTUJE. Tváriť sa, že vieme prijať
  // platbu, a spadnúť až pri kliknutí, je horšie než sem nemať cestu vôbec.
  if (!isStripeConfigured()) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Tréner má vlastnú stránku s hladinami. Toto je smerovanie — skutočnou
  // hranicou je server action, ktorá si rolu overuje sama.
  if (profile?.role === "coach") {
    redirect("/subscribe");
  }

  const subscription = await getSubscription(supabase, user.id);
  const t = await getTranslations("Subscribe");
  const { paid } = await searchParams;

  // Kto už platí, nemá vidieť ponuku znova — rovnaký dôvod ako u trénera.
  const alreadyPaying = subscription.status === "active";

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-5 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">
          {t("follower.title")}
        </h1>
        {!alreadyPaying && (
          <p className="text-sm text-muted">{t("follower.intro")}</p>
        )}
      </header>

      {paid === "1" && !alreadyPaying && (
        <div className="rounded-xl border border-emerald-500 bg-emerald-950 px-4 py-3 text-sm text-emerald-200">
          <p className="font-medium">{t("paidTitle")}</p>
          <p className="text-emerald-300">{t("paidText")}</p>
        </div>
      )}

      {alreadyPaying ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary bg-surface p-5">
          <p className="font-semibold text-foreground">
            {t("follower.activeTitle")}
          </p>
          <p className="text-sm text-muted">{t("follower.activeText")}</p>
          {/* Zmena a zrušenie sú v zákazníckom portáli Stripe a ten má dvere
              v nastaveniach — nie tu, aby neboli dvoje. */}
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline underline-offset-2"
          >
            {t("activeChange")}
          </Link>
        </div>
      ) : (
        <FollowerPlanPicker
          plan={{
            price: {
              month: formatEur(FOLLOWER_PRICE.monthly),
              year: formatEur(FOLLOWER_PRICE.yearly),
            },
            lookupKey: {
              month: priceLookupKey(FOLLOWER_PRODUCT_ID, "month"),
              year: priceLookupKey(FOLLOWER_PRODUCT_ID, "year"),
            },
            centsPerDay: centsPerPlayerDay(FOLLOWER_PRICE.yearly, 1),
          }}
        />
      )}

      <Link
        href="/parent"
        className="text-center text-sm text-muted underline underline-offset-2 transition-colors hover:text-foreground"
      >
        {t("back")}
      </Link>
    </div>
  );
}
