import Link from "next/link";
import type { Metadata } from "next";
import { loadFederacieMessages } from "@/lib/landing-locale";
import { OrgDiagram } from "@/components/org-diagram";
import { Wordmark } from "@/components/wordmark";
import { publicRobots } from "@/lib/seo";
import { ogMetadata } from "@/lib/og";
import { PublicAnalytics } from "@/components/public-analytics";

/**
 * Verejná stránka o federačnom (B2B) režime — informačná, **bez prihlásenia
 * a bez registračného tlačidla**: organizácia sa nezakladá samoobslužne, robí sa to
 * ručne (docs/onboarding-organizacie.md), takže tlačidlo „registrovať" by
 * viedlo do prázdna.
 *
 * Žije **len na plaw.online** (verejná tvár) — `proxy.ts` ju tam púšťa cez
 * PUBLIC_PATHS a na plaw.win ju presmeruje sem, aby mala jedinú adresu.
 *
 * Je **SK/EN a predvolene po ANGLICKY** (od 2026-08-31) — federačný produkt sa
 * ponúka aj mimo Slovenska. Dva jazyky, nie deväť ako landing: kto má v cookie
 * iný jazyk, dostane angličtinu. Do 2026-08-31 bola stránka len slovenská
 * s odôvodnením, že prvými B2B zákazníkmi sú slovenské zväzy — **bol to
 * predpoklad, nie rozhodnutie.** Zvyšok vzhľadu je zhodný s landingom
 * a návodmi — tmavá téma cez tokeny.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await loadFederacieMessages();
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    // Noindex ako zvyšok verejného webu, kým nie je spustený naostro.
    robots: publicRobots(),
    // Od 2026-10-07 je to domov plaw.online (`/` sem presmeruje), takže
    // náhľad odkazu na zväzovú doménu nesie práve táto stránka.
    ...ogMetadata({
      face: "org",
      title: t.metaTitle,
      description: t.metaDescription,
    }),
  };
}

export default async function FederaciePage() {
  const t = await loadFederacieMessages();

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      {/* Dekoratívne rozmazané pozadie za hlavičkou (nádych primárnej farby) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-170px] h-[460px] w-[780px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="P.L.A.W">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {t.backToHome}
            </Link>
            {/* Jediný kontakt je úplne dole (na mobile ~3 500 px), preto
                skratka naň z hlavičky, ktorá ostáva prilepená hore. */}
            <a
              href="#pricing"
              className="rounded-full border border-primary/50 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {t.pricingNav}
            </a>
          </div>
        </div>
      </header>

      <main className="flex w-full min-w-0 flex-col items-center">
        {/* Úvod: text a kresba organizácie — na počítači vedľa seba, na
            telefóne kresba pod textom (od 2026-10-12). */}
        <section className="grid w-full max-w-5xl items-center gap-10 px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <h1 className="text-4xl font-bold tracking-tight text-balance text-foreground sm:text-5xl">
              {t.title}
            </h1>
            <p className="max-w-xl text-base text-balance text-muted sm:text-lg">
              {t.subtitle}
            </p>
            <p className="text-sm font-medium text-foreground/85">
              {t.audience}
            </p>
          </div>
          <OrgDiagram
            labels={t.diagram}
            className="mx-auto w-full max-w-sm text-primary lg:max-w-md"
          />
        </section>

        {/* Tri piliere, ktoré zväz naozaj kupuje — veľké, nadpis vľavo a text
            vpravo, oddelené čiarou. Do 2026-10-12 to bolo sedem rovnakých
            kariet s ikonkou v štvorčeku (kritika Impeccable: všetko rovnako
            dôležité, nič nevynikne). */}
        <section className="w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t.pillarsTitle}
          </h2>
          <div className="divide-y divide-border border-y border-border">
            {t.pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="grid gap-3 py-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-10"
              >
                <h3 className="text-xl font-semibold tracking-tight text-balance text-primary sm:text-2xl">
                  {pillar.title}
                </h3>
                <p className="text-base leading-relaxed text-muted sm:text-lg">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <h2 className="mb-6 text-lg font-semibold text-foreground">
            {t.featuresTitle}
          </h2>
          <ul className="grid gap-x-10 gap-y-6 md:grid-cols-3">
            {t.features.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary"
                />
                <span className="min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {feature.description}
                  </p>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tour team je VLASTNÁ organizácia (vlastná adresa aj pult), nie
            funkcia zväzu — v zozname „Also included" pôsobil ako súčasť
            zväzu, preto samostatný blok (user, 2026-10-12). */}
        <section className="w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="rounded-2xl border border-primary/40 bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-balance text-primary sm:text-2xl">
              {t.tourTeam.title}
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
              {t.tourTeam.description}
            </p>
          </div>
        </section>

        {/* Kroky vedľa seba na širokej obrazovke, číslo len raz (do
            2026-10-12 bolo dvakrát: „1" v štvorčeku aj „STEP 1"). */}
        <section className="w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t.howTitle}
          </h2>
          <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
            {t.steps.map((step, index) => (
              <li key={step.title} className="border-t border-primary/60 pt-4">
                <span className="text-3xl font-semibold tabular-nums text-primary">
                  {index + 1}
                </span>
                <h3 className="mt-2 font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Poznámky a cena v jednom bloku: čo musí zväz vedieť (GDPR, zámok
            tréningu, samostatný účet), stojí hneď pred jediným kontaktom. */}
        <section
          id="pricing"
          className="w-full max-w-3xl scroll-mt-20 px-4 py-8 sm:px-6 sm:py-12"
        >
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">
              {t.notesTitle}
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {t.notes.map((note) => (
                <li key={note} className="flex gap-2.5 text-sm text-muted">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary"
                  />
                  <span className="leading-relaxed">{note}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-border pt-8 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {t.pricingTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
                {t.pricingText}
              </p>
              {/* Jediná výzva na akciu na celej stránke a je zámerne len
                  e-mail: organizácia sa nezakladá samoobslužne, takže tlačidlo
                  „registrovať" by viedlo do prázdna. Adresa je `office@`
                  (obchod), nie `support@` — ten patrí k zmluvám a k podpore
                  existujúceho zákazníka. Adresa je vypísaná celá, aby si ju
                  dal skopírovať aj ten, komu `mailto` neotvorí poštu. */}
              <p className="mx-auto mt-6 max-w-md text-sm text-foreground/85">
                {t.pricingContact}
              </p>
              <a
                href={`mailto:office@plawsports.com?subject=${encodeURIComponent(t.pricingEmailSubject)}`}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                office@plawsports.com
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Organizácia má vlastné zásady; zmluvy sem nepatria — tie sa podpisujú
          a dostane ich ako dokument (docs/onboarding-organizacie.md). */}
      <footer className="w-full max-w-5xl px-4 py-8 text-center text-xs text-muted sm:px-6">
        {t.footerTagline}
        <span className="mx-2">·</span>
        <Link
          href="/zasady-organizacia"
          className="underline transition-colors hover:text-foreground"
        >
          Privacy
        </Link>
      </footer>
      <PublicAnalytics />
    </div>
  );
}
