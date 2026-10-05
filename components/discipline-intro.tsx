import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/wordmark";

/**
 * Úvodná obrazovka disciplíny bez tenisového landingu (kondička na
 * `fitness.plawsports.com`, od 2026-09-21) — fotka, názov appky a dve
 * tlačidlá. Od 2026-10-02 je to **vrch kondičného landingu**
 * (`components/landing-fitness.tsx`): dostane vetu pod štítok a odkaz na
 * cenník nižšie. Oboje je nepovinné — bez nich je to pôvodná obrazovka bez
 * sľubov.
 *
 * Rozloženie aj stmavenie (`.hero-scrim` v globals.css) sú tie isté ako úvod
 * tenisového landingu na telefóne, aby obe appky pôsobili ako súrodenci.
 * Fotka aj štítok idú z konfigurácie disciplíny (`intro`, `label`).
 *
 * Na rozdiel od tenisu sa ukazuje aj na počítači — iný úvod tu nie je. Fotka
 * je na výšku, takže na širokej obrazovke sa zarovná na stred (tam je
 * výbava), nie na spodok ako na telefóne.
 */
export async function DisciplineIntro({
  photo,
  label,
  domain,
  subtitle,
  more,
}: {
  /**
   * `null` = šport ešte nemá vlastnú fotku (padel od 2026-10-05). Úvod je
   * potom len tmavé pozadie — fotka z iného športu by klamala.
   */
  photo: string | null;
  label: string;
  domain: string;
  /** Jedna veta pod štítkom — čo appka je. */
  subtitle?: string;
  /**
   * Odkaz na obsah pod fotkou. Fotka zaberá celú obrazovku, takže bez neho
   * nie je vidno, že stránka pokračuje.
   */
  more?: { href: string; label: string };
}) {
  const t = await getTranslations("Home");

  return (
    <section className="relative isolate flex min-h-svh w-full min-w-0 flex-col items-center justify-between overflow-hidden px-4 pb-10 pt-20 text-center">
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            aria-hidden
            fetchPriority="high"
            width={1080}
            height={1910}
            className="absolute inset-x-0 top-0 -z-20 h-[86%] w-full object-cover object-bottom md:object-center"
          />
          <div aria-hidden className="hero-scrim absolute inset-x-0 top-0 -z-10 h-[86%]" />
        </>
      )}

      {/* Adresa nasadenia úplne hore (user, 2026-09-21) — nech je hneď
          jasné, v ktorej appke človek je. Nad nápisom ostáva `pt-20`, takže
          sa s ním ani na malom telefóne nestretne. */}
      <p className="absolute inset-x-0 top-6 text-xs font-medium tracking-[0.2em] text-foreground/70">
        {domain}
      </p>

      <div className="flex flex-col items-center gap-4">
        {/* Bodky nesú primárnu farbu nasadenia (kondička tyrkysová) —
            rovnako ako na verejnom webe. */}
        <Wordmark variant="hero" as="h1" />
        <span aria-hidden className="h-px w-24 bg-foreground/40" />
        {/* Rozpis skratky sa neprekladá — je viazaný na písmená P-L-A-W. */}
        <p className="mr-[-0.4em] text-xs font-medium uppercase tracking-[0.4em] text-foreground/85">
          Plan · Log · Analyze · Win
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-background/50 px-3 py-1 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/40 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {label}
        </span>
        {subtitle ? (
          <p className="mt-1 max-w-xs text-sm text-balance text-foreground/85">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/register"
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover"
        >
          {t("register")}
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
        <Link
          href="/login"
          className="rounded-full border border-foreground/25 bg-background/50 px-5 py-3.5 text-base font-medium text-foreground backdrop-blur-sm transition hover:bg-surface"
        >
          {t("login")}
        </Link>
        {more ? (
          <a
            href={more.href}
            className="mt-1 text-sm font-medium text-foreground/80 underline underline-offset-4 transition-colors hover:text-foreground"
          >
            {more.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
