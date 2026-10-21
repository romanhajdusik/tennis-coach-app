import Link from "next/link";
import { SelfDiaryInvite } from "@/components/self-diary-invite";
import { getTranslations } from "next-intl/server";
import {
  loadLandingPadelMessages,
  loadLandingMessages,
} from "@/lib/landing-locale";
import { LandingPricing } from "@/components/landing-pricing";
import { DisciplineIntro } from "@/components/discipline-intro";
import { coachTierViews } from "@/lib/landing-pricing";
import {
  PadelCourt,
  PadelCourtGlyph,
  type CourtGlyphVariant,
} from "@/components/padel-court";
import type { DisciplineConfig } from "@/lib/discipline";

// Poradie sedí s bodmi v `landing-padel.json`: vlastné cvičenia, kam ide
// čas, dvojica.
const POINT_GLYPHS: CourtGlyphVariant[] = ["drills", "time", "pair"];

/**
 * Landing PADELU na `plawpadel.com` (od 2026-10-05, doména od 2026-10-11). **Každý šport má
 * vlastný landing** (rozhodol user; spoločný pre všetky športy zamietol) —
 * zdieľajú sa len stavebné kocky (úvod, cenník), texty a obsah sú padelové.
 * Rozcestník všetkých športov bude na `plawsports.com`.
 *
 * **Zatiaľ krátky ako kondička:** úvod, tri body, cenník, pätička.
 * - **Bez fotky**, kým nebude padelová — tenisová by klamala. Od 2026-10-11
 *   je namiesto nej kresba kurtu (`components/padel-court.tsx`) a body
 *   hovoria o padeli (dvojica namiesto kondičky; kondička je veta pod nimi).
 * - **Žiadne screenshoty** — padelové nemáme a tenisové by klamali.
 * - **Žiadny odkaz pre rodiča na plaw.click** — tá stránka menuje tenis
 *   (otvorená otázka č. 5 v docs §1.1).
 * - **Cenník je ten istý komponent aj tie isté riadky** ako v tenise: ceny sú
 *   rovnaké (otázka č. 3) a sľub „bez predplatného" stráži `WITHOUT_SUBSCRIPTION`.
 *
 * **Na produkcii smie byť, len keď sa v padeli dá naozaj zaplatiť** (ostré
 * padelové produkty v Stripe + kľúč v jeho Vercel projekte). Pripravovať sa
 * smie skôr, lebo bez `PLAW_INDEXING` je web `noindex` (`lib/seo.ts`).
 */
export async function LandingPadel({
  config,
}: {
  config: Pick<DisciplineConfig, "intro" | "label" | "domain">;
}) {
  const t = await loadLandingPadelMessages();
  const shared = await loadLandingMessages();
  const tHome = await getTranslations("Home");

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <DisciplineIntro
        photo={config.intro?.photo ?? null}
        label={config.label}
        domain={config.domain}
        subtitle={t.heroSubtitle}
        more={{ href: "#pricing", label: t.pricingTitle }}
        backdrop={<PadelCourt className="h-full w-auto max-w-full" />}
      />

      {/* Body ako zoznam s kúskom kurtu, nie tri karty s ikonkou v
          štvorčeku — to je najbežnejší vzor SaaS landingov (kritika
          Impeccable 2026-10-11). Značka pri bode ukazuje, o ktorú časť
          kurtu ide. */}
      <section className="w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.pointsTitle}
        </h2>
        <ul className="mt-10 divide-y divide-border border-y border-border">
          {t.points.map((point, index) => (
            <li key={point.title} className="flex gap-5 py-6 sm:gap-7">
              <PadelCourtGlyph
                variant={POINT_GLYPHS[index % POINT_GLYPHS.length]}
                className="h-16 w-9 shrink-0 text-primary"
              />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {point.title}
                </h3>
                <p className="mt-1.5 leading-relaxed text-muted">{point.text}</p>
              </div>
            </li>
          ))}
        </ul>
        {t.pointsNote ? (
          <p className="mt-6 text-center text-sm text-balance text-muted">
            {t.pointsNote}
          </p>
        ) : null}
      </section>

      <section
        id="pricing"
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

      {/* Hráč, ktorého tréner P.L.A.W nepoužíva, si môže zapisovať sám (docs §6). */}
      <SelfDiaryInvite t={t.selfDiary} />

      {/* Odkazy vedú na znenie pre TRÉNERA. Sú relatívne — proxy ich
          z padelovej domény presmeruje na ich jedinú adresu (CANONICAL_ORIGINS). */}
      <footer className="w-full max-w-5xl px-4 py-8 text-center text-xs text-muted sm:px-6">
        {t.footerTagline}
        <span className="mx-2">·</span>
        <Link href="/terms" className="underline transition-colors hover:text-foreground">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="underline transition-colors hover:text-foreground">
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
