import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  loadLandingPickleballMessages,
  loadLandingMessages,
} from "@/lib/landing-locale";
import { LandingPricing } from "@/components/landing-pricing";
import { DisciplineIntro } from "@/components/discipline-intro";
import { coachTierViews } from "@/lib/landing-pricing";
import { ChartBarIcon, TagIcon, UsersIcon } from "@/components/landing-icons";
import type { DisciplineConfig } from "@/lib/discipline";

const POINT_ICONS = [TagIcon, ChartBarIcon, UsersIcon];

/**
 * Landing PICKLEBALLU na `pickleball.plawsports.com` (od 2026-10-05). **Každý šport má
 * vlastný landing** (rozhodol user; spoločný pre všetky športy zamietol) —
 * zdieľajú sa len stavebné kocky (úvod, cenník), texty a obsah sú pickleballové.
 * Rozcestník všetkých športov bude na `plawsports.com`.
 *
 * **Zatiaľ krátky ako kondička:** úvod, tri body, cenník, pätička.
 * - **Bez fotky**, kým nebude pickleballová — tenisová by klamala.
 * - **Žiadne screenshoty** — pickleballové nemáme a tenisové by klamali.
 * - **Žiadny odkaz pre rodiča na plaw.click** — tá stránka menuje tenis
 *   (otvorená otázka č. 5 v docs §1.1).
 * - **Cenník je ten istý komponent aj tie isté riadky** ako v tenise: ceny sú
 *   rovnaké (otázka č. 3) a sľub „bez predplatného" stráži `WITHOUT_SUBSCRIPTION`.
 *
 * **Na produkcii smie byť, len keď sa v pickleballe dá naozaj zaplatiť** (ostré
 * pickleballové produkty v Stripe + kľúč v jeho Vercel projekte). Pripravovať sa
 * smie skôr, lebo bez `PLAW_INDEXING` je web `noindex` (`lib/seo.ts`).
 */
export async function LandingPickleball({
  config,
}: {
  config: Pick<DisciplineConfig, "intro" | "label" | "domain">;
}) {
  const t = await loadLandingPickleballMessages();
  const shared = await loadLandingMessages();
  const tHome = await getTranslations("Home");

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <DisciplineIntro
        photo={config.intro?.photo ?? null}
        label={config.label}
        domain={config.domain}
        subtitle={t.heroSubtitle}
        more={{ href: "#cennik", label: t.pricingTitle }}
      />

      <section className="w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.pointsTitle}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {t.points.map((point, index) => {
            const Icon = POINT_ICONS[index % POINT_ICONS.length];
            return (
              <div
                key={point.title}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1.5 font-semibold text-foreground">
                  {point.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {point.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        id="cennik"
        className="w-full max-w-5xl scroll-mt-6 px-4 py-8 sm:px-6 sm:py-12"
      >
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.pricingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-balance text-muted">
          {t.pricingSubtitle}
        </p>
        <LandingPricing
          tiers={coachTierViews(shared.pricingPlayerCounts)}
          labels={{
            monthly: shared.pricingMonthly,
            yearly: shared.pricingYearly,
            yearlySave: shared.pricingYearlySave,
            perMonth: shared.pricingPerMonth,
            monthlyYearTotal: shared.pricingMonthlyYearTotal,
            perYear: shared.pricingPerYear,
            yearlyNote: shared.pricingYearlyNote,
            perDay: shared.pricingPerDay,
            recommended: shared.pricingRecommended,
            compareTitle: shared.pricingCompareTitle,
            compareWithoutSub: shared.pricingCompareWithoutSub,
            comparePaid: shared.pricingComparePaid,
            compareRows: shared.pricingCompareRows,
            compareNote: shared.pricingCompareNote,
            vat: shared.pricingVat,
            cta: tHome("register"),
          }}
        />
      </section>

      {/* Odkazy vedú na znenie pre TRÉNERA. Sú relatívne — proxy ich
          z pickleballovej domény presmeruje na ich jedinú adresu (CANONICAL_ORIGINS). */}
      <footer className="w-full max-w-5xl px-4 py-8 text-center text-xs text-muted sm:px-6">
        {t.footerTagline}
        <span className="mx-2">·</span>
        <Link href="/podmienky" className="underline transition-colors hover:text-foreground">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/zasady" className="underline transition-colors hover:text-foreground">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <a
          href="mailto:info@plawsports.com"
          className="underline transition-colors hover:text-foreground"
        >
          info@plawsports.com
        </a>
      </footer>
    </div>
  );
}
