import Link from "next/link";
import { getLandingLocale } from "@/components/landing-page";
import { LandingLanguageSwitcher } from "@/components/landing-language-switcher";
import { loadLandingHracMessages } from "@/lib/landing-locale";
import { APP_ORIGIN } from "@/lib/public-face";
import {
  FOLLOWER_PRICE,
  centsPerPlayerDay,
  formatEur,
} from "@/lib/landing-pricing";
import {
  CalendarIcon,
  ChartBarIcon,
  ClipboardCheckIcon,
  EyeIcon,
  ShieldCheckIcon,
  TagIcon,
} from "@/components/landing-icons";

/**
 * Landing pre hráča, rodiča a manažéra — domovská stránka domény plaw.click
 * (`app/page.tsx` ju vykreslí podľa hostname, rovnako ako rozcestník na
 * plaw.online). Do 2026-08-22 hovoril celý verejný web len k trénerovi a druhá
 * strana appky mala len návod a cenník; toto je jej prvá predajná stránka.
 *
 * Publikum je zámerne LEN sledujúci (hráč, rodič, manažér). Tréner s jediným
 * hráčom sem nepatrí — je to iný produkt (zapisuje, platí trénerskú hladinu),
 * a keby stáli obe ceny vedľa seba, čítalo by sa to ako dva plány toho istého.
 * Preto z tejto stránky vedie na trénerský web len jeden odkaz úplne dole.
 */
const FEATURE_ICONS = [
  ClipboardCheckIcon,
  TagIcon,
  CalendarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  EyeIcon,
];

/**
 * Ktoré dlaždice sú za predplatným. Poradie sedí s `features` v prekladoch a
 * s modelom v `docs/cennik-navrh.md` §8.3: zoznam tréningov, detail, uchovanie
 * histórie a read-only prístup má sledujúci vždy, KALENDÁR a ANALYTIKA sú za
 * platbou. Drží sa to v kóde, nie v prekladoch — inak by sa deväť jazykov
 * mohlo rozísť v tom, čo appka sľubuje.
 *
 * **Appka to zatiaľ nevynucuje** — stráž na čítanie (`requireViewAccess`) sa
 * stavia so Stripe. Keď sa bude stavať, musí sedieť s týmto poľom aj s
 * `WITHOUT_SUBSCRIPTION` v `app/cennik-hrac/page.tsx`.
 */
const PAID_FEATURES = [false, false, true, true, false, false];

/**
 * Zábery appky (plán → záznam → analýza). Sú to **tie isté súbory ako na
 * trénerskej landing** — sledujúci vidí tie isté obrazovky, len bez tlačidiel
 * na zápis.
 *
 * Zámerne LEN anglická sada, vo všetkých deviatich jazykoch — rovnako ako na
 * trénerskej landing (zjednotené 2026-08-22): appka je od 2026-07-28 výhradne
 * anglická (`i18n/request.ts`), takže slovenské zábery ukazovali UI, ktoré
 * v produkte už neexistuje, a boli zmazané. Popisky pod zábermi preložené
 * sú — tie sú súčasťou webu, nie appky.
 */
const SHOWCASE = ["calendar", "session", "analytics"] as const;

export async function LandingHrac() {
  const locale = await getLandingLocale();
  const t = await loadLandingHracMessages(locale);

  // Cenu formátuje server podľa jazyka (36,00 € vs €36.00) a centy na deň sa
  // dopočítavajú z nej — nikdy sa neopisujú z dokumentu, inak by pri zmene
  // ceny ostalo v texte staré číslo.
  const yearly = formatEur(locale, FOLLOWER_PRICE.yearly);
  const cents = centsPerPlayerDay(locale, FOLLOWER_PRICE.yearly, 1);

  return (
    <div className="relative flex w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-[-120px] top-[80px] h-[320px] w-[320px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <span className="rounded-md bg-[#eef0f0] p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/plaw-logo.webp"
              alt="P.L.A.W — Plan. Log. Analyze. Win."
              className="block h-7 w-auto"
            />
          </span>
          <LandingLanguageSwitcher currentLocale={locale} />
        </div>
      </header>

      <section className="flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-14 pt-14 text-center sm:px-6 sm:pb-20 sm:pt-20">
        <span className="rounded-2xl border border-border bg-[#eef0f0] p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plaw-logo.webp"
            alt="P.L.A.W — Plan. Log. Analyze. Win."
            className="block h-auto w-full max-w-[240px] sm:max-w-[300px]"
          />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t.eyebrow}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
          {t.heroTitle}
        </h1>
        <p className="max-w-xl text-base text-balance text-muted sm:text-lg">
          {t.heroSubtitle}
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/parent/login"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href="#ako-to-funguje"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </section>

      <section
        id="ako-to-funguje"
        className="w-full max-w-5xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16"
      >
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.howTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-balance text-muted">
          {t.howSubtitle}
        </p>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {t.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                {t.stepWord}
              </div>
              <h3 className="mb-1.5 font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.showcaseTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-balance text-muted">
          {t.showcaseSubtitle}
        </p>
        <div className="mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 md:flex-wrap md:justify-center md:overflow-visible md:pb-0">
          {SHOWCASE.map((key) => (
            <figure
              key={key}
              className="flex shrink-0 snap-center flex-col items-center gap-3"
            >
              <div className="w-[220px] rounded-[2rem] bg-input p-2.5 shadow-2xl ring-1 ring-border transition hover:-translate-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/screenshots/en/${key}.webp`}
                  alt={t.showcaseCaptions[key]}
                  width={640}
                  height={1385}
                  loading="lazy"
                  className="block w-full rounded-[1.5rem]"
                />
              </div>
              <figcaption className="max-w-[220px] text-center text-sm text-muted">
                {t.showcaseCaptions[key]}
              </figcaption>
            </figure>
          ))}
        </div>
        {/* Dva z troch záberov ukazujú funkcie za predplatným — bez tejto vety
            by sekcia sľubovala viac, než sledujúci bez neho dostane. */}
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-balance text-muted">
          {t.showcaseNote}
        </p>
      </section>

      <section className="w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.featuresTitle}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                    <Icon className="h-5 w-5" />
                  </div>
                  {/* Kalendár a analytika sú za predplatným — nesmú sa tváriť
                      ako samozrejmosť (docs/cennik-navrh.md §8.3). */}
                  {PAID_FEATURES[index] ? (
                    <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[0.7rem] font-medium text-foreground ring-1 ring-inset ring-primary/30">
                      {t.featurePaidBadge}
                    </span>
                  ) : null}
                </div>
                <h3 className="mb-1.5 font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Argument o transparentnosti pôvodne stál na trénerskej landing ako
          veta, ktorú tréner hovorí rodičovi (commit a0638c7 ho odtiaľ zniesol).
          Tu hovorí priamo k sledujúcemu, preto je to sľub appky, nie citát
          trénera. Sľubuje výhradne NAHLIADNUTIE u sledujúceho: prenos histórie
          na nového trénera neexistuje a nebude (jediná policy na
          `parent_session_records` je `parent_id = auth.uid()`). */}
      <section className="w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          {t.transparencyTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
          {t.transparencyIntro}
        </p>
        <blockquote className="mt-6 rounded-2xl border border-border border-l-4 border-l-primary bg-surface p-5 text-base leading-relaxed text-foreground sm:p-6">
          {t.transparencyQuote}
        </blockquote>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-balance text-muted">
          {t.transparencyNote}
        </p>
      </section>

      {/* Celý cenník (mesačná cena, tabuľka bez predplatného vs. s ním) žije na
          /cennik-hrac — tu je len jedno číslo a odkaz, nech landing nepredáva
          dvakrát to isté. */}
      <section className="w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t.pricingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-base text-balance text-muted">
          {t.pricingSubtitle}
        </p>

        <div className="mt-6 rounded-2xl border border-primary/60 bg-surface p-6 shadow-lg shadow-primary/10 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-center gap-1.5">
            <span className="text-4xl font-bold tracking-tight text-foreground">
              {yearly}
            </span>
            <span className="text-sm text-muted">{t.pricingPerYear}</span>
          </div>
          <p className="mt-2 text-center text-sm text-foreground">
            {t.pricingPerDay.replace("{amount}", cents)}
          </p>
          <p className="mt-1 text-center text-sm text-muted">{t.pricingTrial}</p>

          <ul className="mx-auto mt-5 flex max-w-xl flex-col gap-3 border-t border-border pt-5">
            {[t.pricingFree, t.pricingOnePlayer].map((note) => (
              <li key={note} className="flex gap-2.5 text-sm text-muted">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 0 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-center">
            <Link
              href="/cennik-hrac"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-background"
            >
              {t.pricingCta}
            </Link>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted">{t.pricingVat}</p>
      </section>

      <section className="relative mt-4 w-full overflow-hidden bg-primary py-14 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
            {t.finalCtaTitle}
          </h2>
          <p className="text-sm text-primary-foreground/80">
            {t.finalCtaSubtitle}
          </p>
          <Link
            href="/parent/login"
            className="mt-2 rounded-lg bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary transition hover:opacity-90"
          >
            {t.finalCtaButton}
          </Link>
        </div>
      </section>

      <div className="flex w-full max-w-3xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted sm:px-6">
        <p>
          {t.guideText}{" "}
          <Link
            href="/navod-hrac"
            className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-muted"
          >
            {t.guideCta}
          </Link>
        </p>
        {/* Jediný odkaz na trénerskú stranu. Tá má vlastnú doménu aj vlastný
            cenník, takže sem nepatrí viac než jedna veta. */}
        <p>
          {t.coachText}{" "}
          <Link
            href={APP_ORIGIN}
            className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-muted"
          >
            {t.coachCta}
          </Link>
        </p>
      </div>

      {/* `info@` je všeobecná adresa; `/federacie` má obchodnú `office@`.
          Samotná adresa sa neprekladá, takže nepribudol kľúč do deviatich
          jazykov — nie je čo rozísť. */}
      <footer className="w-full max-w-5xl px-4 pb-8 text-center text-xs text-muted sm:px-6">
        {t.footerTagline}
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
