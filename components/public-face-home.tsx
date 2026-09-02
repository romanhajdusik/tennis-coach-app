import Link from "next/link";
import { getLandingLocale } from "@/components/landing-page";
import { LandingLanguageSwitcher } from "@/components/landing-language-switcher";
import {
  loadRozcestnikMessages,
  rozcestnikLocale,
} from "@/lib/landing-locale";
import { EyeIcon, GlobeIcon, UsersIcon } from "@/components/landing-icons";
import { PARENT_ORIGIN } from "@/lib/public-face";

/**
 * Domovská stránka verejnej tváre (plaw.online) — **rozcestník medzi dvoma
 * produktmi**, nie consumer landing. Ten ostáva na plaw.win, kam vedú prvé
 * dvere; druhé vedú na `/federacie`.
 *
 * Dôvod: plaw.online je jediné miesto, kde stoja obe ponuky vedľa seba ako
 * rovnocenné. Predtým tu bol ten istý landing ako na plaw.win, takže na
 * federačnú stránku neviedol odkaz odnikiaľ.
 *
 * Je len **SK/EN** (rozhodnuté 2026-08-07) — za federačnými dverami je
 * slovenská stránka a rozcestník je pár viet. Prepínač preto ponúka dva jazyky,
 * nie deväť ako landing; kto má v cookie iný jazyk, dostane angličtinu.
 */
export async function PublicFaceHome() {
  const landingLocale = await getLandingLocale();
  const locale = rozcestnikLocale(landingLocale);
  const t = await loadRozcestnikMessages(locale);

  return (
    <div className="relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <header className="w-full max-w-4xl px-4 py-4 sm:px-6">
        <div className="flex justify-end">
          <LandingLanguageSwitcher
            currentLocale={locale}
            locales={["en", "sk"]}
          />
        </div>
      </header>

      <section className="flex w-full max-w-2xl flex-col items-center gap-5 px-4 pb-10 pt-6 text-center sm:px-6 sm:pb-14 sm:pt-10">
        <span className="rounded-2xl border border-border bg-[#eef0f0] p-3 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plaw-logo.webp"
            alt="P.L.A.W — Plan. Log. Analyze. Win."
            className="block h-auto w-full max-w-[240px] sm:max-w-[300px]"
          />
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
          {t.title}
        </h1>
        <p className="max-w-lg text-base text-balance text-muted">
          {t.subtitle}
        </p>
      </section>

      {/* Troje dvere. Na mobile pod sebou, od `md` vedľa seba a rovnako vysoké,
          aby ani jedna ponuka nepôsobila ako tá hlavná. Tri stĺpce až od `md`:
          na `sm` by boli karty užšie než ich vlastný nadpis. */}
      <section className="grid w-full max-w-5xl grid-cols-1 gap-4 px-4 pb-12 md:grid-cols-3 sm:px-6">
        <Door
          href="https://plaw.win"
          icon={<UsersIcon className="h-5 w-5" />}
          title={t.consumerTitle}
          text={t.consumerText}
          cta={t.consumerCta}
        />
        <Door
          href={PARENT_ORIGIN}
          icon={<EyeIcon className="h-5 w-5" />}
          title={t.followerTitle}
          text={t.followerText}
          cta={t.followerCta}
        />
        <Door
          href="/federacie"
          icon={<GlobeIcon className="h-5 w-5" />}
          title={t.orgTitle}
          text={t.orgText}
          cta={t.orgCta}
        />
      </section>

      <section className="w-full max-w-4xl px-4 pb-12 sm:px-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5 text-center sm:flex-row sm:justify-center sm:gap-6">
          <span className="text-sm font-medium text-foreground">
            {t.guidesTitle}
          </span>
          <span className="flex flex-wrap justify-center gap-3">
            <Link
              href="/navod"
              className="text-sm text-muted underline transition-colors hover:text-foreground"
            >
              {t.guideCoach}
            </Link>
            <Link
              href="/navod-hrac"
              className="text-sm text-muted underline transition-colors hover:text-foreground"
            >
              {t.guidePlayer}
            </Link>
          </span>
        </div>
      </section>

      {/* `info@` je všeobecná adresa; `/federacie` má obchodnú `office@`.
          Samotná adresa sa neprekladá, takže nepribudol kľúč do prekladov. */}
      <footer className="mt-auto w-full max-w-4xl px-4 py-8 text-center text-xs text-muted sm:px-6">
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

function Door({
  href,
  icon,
  title,
  text,
  cta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
        {icon}
      </span>
      <span className="text-lg font-semibold text-foreground">{title}</span>
      <span className="text-sm leading-relaxed text-muted">{text}</span>
      <span className="mt-auto pt-2 text-sm font-medium text-foreground">
        {cta}{" "}
        <span aria-hidden className="transition-transform group-hover:ml-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
