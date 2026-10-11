import Link from "next/link";
import type { Metadata } from "next";
import { loadLandingMessages, loadNotebookMessages } from "@/lib/landing-locale";
import { COACH_TIERS, centsPerPlayerDay, formatEur } from "@/lib/landing-pricing";
import { Wordmark } from "@/components/wordmark";
import { PublicAnalytics } from "@/components/public-analytics";
import { publicRobots } from "@/lib/seo";

/**
 * Stránka pre ľudí z reklamy na Instagrame (od 2026-10-11).
 *
 * Reklama sa pýta „Still writing practices in a notebook?" a viedla na
 * landing, kde o zošite nebolo ani slovo — z ~300 ľudí z Instagramu otvorili
 * registráciu dvaja (Vercel Analytics, 8.–10. 10.). Táto stránka preto začína
 * TOU ISTOU otázkou a tou istou fotkou ako reklama a hneď ponúka registráciu.
 *
 * Zámerne krátka: otázka → porovnanie so zošitom → skutočné obrazovky → cena.
 * Celý cenník a funkcie ostávajú na landingu (odkaz „See all plans").
 *
 * Cena sa berie z `lib/landing-pricing.ts` (najnižšia hladina, mesačne) —
 * nikdy ju sem nepíš natvrdo.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await loadNotebookMessages();
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: publicRobots(),
  };
}

const SHOWCASE = ["calendar", "session", "analytics"] as const;

export default async function NotebookPage() {
  const t = await loadNotebookMessages();
  const landing = await loadLandingMessages();
  const entry = COACH_TIERS[0];
  const priceLine = t.priceLine
    .replace("{price}", formatEur(entry.monthly))
    .replace("{cents}", centsPerPlayerDay(entry.monthly * 12, entry.players));

  const cta = (
    <div className="flex w-full max-w-sm flex-col items-center gap-2">
      <Link
        href="/register"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover"
      >
        {t.cta}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
      <p className="text-sm text-muted">{t.ctaNote}</p>
      <p className="text-center text-sm text-balance text-foreground">
        {priceLine}
      </p>
    </div>
  );

  return (
    <div className="flex w-full min-w-0 flex-col items-center bg-background">
      <section className="flex w-full max-w-md flex-col items-center gap-5 px-4 pb-10 pt-6 text-center">
        <Wordmark />
        {/* Tá istá fotka ako v reklame — človek má hneď vidieť, že je na
            správnom mieste. Vygenerovaná (AI), bez rozhrania appky. Celá,
            neorezaná (user: orezaná hlava sa mu nepáčila); nadpis je cez
            tmavú oblohu hore, zošit s telefónom ostáva voľný. */}
        <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/notebook.jpg"
            alt=""
            width={1080}
            height={1080}
            fetchPriority="high"
            className="block w-full"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-background/90 via-background/55 to-transparent"
          />
          <h1 className="absolute inset-x-0 top-0 px-4 pt-5 text-3xl font-bold tracking-tight text-balance text-foreground [text-shadow:0_2px_12px_rgb(0_0_0/0.6)] sm:text-4xl">
            {t.titleBefore} <span className="text-primary">{t.titleHighlight}</span>
          </h1>
        </div>
        <p className="text-base text-balance text-muted">{t.lead}</p>
        {cta}
      </section>

      <section className="w-full max-w-md px-4 py-10">
        <h2 className="mb-5 text-center text-2xl font-semibold tracking-tight text-foreground">
          {t.compareTitle}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-2 bg-surface text-sm font-semibold">
            <div className="px-4 py-3 text-muted">{t.compareNotebook}</div>
            <div className="px-4 py-3 text-primary">{t.compareApp}</div>
          </div>
          {t.compareRows.map((row) => (
            <div
              key={row.app}
              className="grid grid-cols-2 border-t border-border text-sm"
            >
              <div className="px-4 py-3 text-muted">{row.notebook}</div>
              <div className="px-4 py-3 font-medium text-foreground">{row.app}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full max-w-5xl px-4 py-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
          {t.showcaseTitle}
        </h2>
        <div className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:justify-center md:overflow-visible md:pb-0">
          {SHOWCASE.map((key) => (
            <figure
              key={key}
              className="flex shrink-0 snap-center flex-col items-center gap-3"
            >
              <div className="w-[220px] rounded-[2rem] bg-input p-2.5 shadow-2xl ring-1 ring-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/screenshots/en/${key}.webp`}
                  alt={landing.showcaseCaptions[key]}
                  width={640}
                  height={1385}
                  loading="lazy"
                  className="block w-full rounded-[1.5rem]"
                />
              </div>
              <figcaption className="max-w-[220px] text-center text-sm text-muted">
                {landing.showcaseCaptions[key]}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="flex w-full max-w-md flex-col items-center gap-5 px-4 pb-16 pt-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
          {t.finalTitle}
        </h2>
        {cta}
        <div className="flex flex-col items-center gap-2 pt-2 text-sm">
          <Link href="/#cennik" className="text-muted underline hover:text-foreground">
            {t.pricingLink}
          </Link>
          <Link href="/login" className="text-muted underline hover:text-foreground">
            {t.signIn}
          </Link>
        </div>
      </section>
      <PublicAnalytics />
    </div>
  );
}
