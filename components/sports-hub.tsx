import { loadSportsHubMessages } from "@/lib/landing-locale";
import { DISCIPLINES, DISCIPLINE_IDS } from "@/lib/disciplines/registry";
import type { DisciplineId } from "@/lib/disciplines/types";
import { Wordmark } from "@/components/wordmark";

/**
 * Farba každej appky — OPÍSANÁ z `app/globals.css` (`data-app`), rovnako ako
 * v `lib/og.ts`: bodka na karte má byť tá istá farba, akú človek uvidí po
 * kliknutí. Pri zmene odtieňa ju zmeň aj tu.
 */
const SPORT_COLOR: Record<DisciplineId, string> = {
  tennis: "#d3ee6c",
  padel: "#f28c28",
  badminton: "#3ec46d",
  pickleball: "#f472b6",
  fitness: "#20a99b",
};

/**
 * Pozadie karty — raketa a loptička daného športu (`public/hub/`). Padel,
 * bedminton, pickleball aj tenis sú vygenerované v Higgsfielde (2026-10-07,
 * jednotný tmavý štýl, náradie vpravo); kondička je výrez z jej landingovej
 * fotky (`public/hero/fitness-portrait.webp`). Nový šport bez obrázka má
 * kartu bez pozadia — nič sa nerozbije.
 */
const SPORT_PHOTO: Partial<Record<DisciplineId, string>> = {
  tennis: "/hub/tennis.webp",
  padel: "/hub/padel.webp",
  badminton: "/hub/badminton.webp",
  pickleball: "/hub/pickleball.webp",
  fitness: "/hub/fitness.webp",
};

/**
 * Ktoré appky už bežia naostro. Šport, ktorý tu nie je, sa ukáže ako
 * „Coming soon" bez odkazu — jeho doména ešte neexistuje a odkaz by viedol
 * do prázdna. **Pri spustení športu (docs §1.1 krok 5) ho sem pridaj.**
 */
const LIVE: ReadonlySet<DisciplineId> = new Set<DisciplineId>(["tennis", "fitness"]);

/**
 * Rozcestník P.L.A.W športov na `plawsports.com` (od 2026-10-07, rozhodol
 * user: „rozcestník bude jednoduchý"). Každý šport má vlastný landing na
 * svojej doméne — tu je len výber.
 *
 * Zoznam ide z konfigurácie disciplín (`DISCIPLINES`), nie z textov: nový
 * šport sa tu objaví sám, len mu treba farbu vyššie. Plánujú sa aj ďalšie
 * individuálne športy, preto mriežka, ktorá unesie ľubovoľný počet.
 */
export async function SportsHub() {
  const t = await loadSportsHubMessages();

  return (
    <div className="relative flex min-h-dvh w-full min-w-0 flex-col items-center overflow-x-clip bg-background">
      <section className="flex w-full max-w-2xl flex-col items-center gap-5 px-4 pb-10 pt-12 text-center sm:px-6 sm:pb-14 sm:pt-20">
        <Wordmark variant="hero" />
        <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
          {t.title}
        </h1>
        <p className="max-w-lg text-base text-balance text-muted">
          {t.subtitle}
        </p>
      </section>

      <section className="grid w-full max-w-3xl grid-cols-1 gap-3 px-4 pb-14 sm:grid-cols-2 sm:px-6">
        {DISCIPLINE_IDS.map((id) => {
          const sport = DISCIPLINES[id];
          const live = LIVE.has(id);
          const photo = SPORT_PHOTO[id];
          const body = (
            <>
              {photo && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className={`absolute inset-0 -z-20 h-full w-full object-cover object-right ${
                      live ? "" : "grayscale"
                    } ${
                      // Kondičná fotka je denná a svetlá, ostatné sú tmavé
                      // štúdiové — bez stmavenia by karta vytŕčala.
                      id === "fitness" ? "brightness-50" : ""
                    }`}
                  />
                  {/* Prechod zľava: text stojí na ploche karty, náradie vpravo
                      ostane vidieť. Kondičná fotka je denná, takže ju stmaví
                      rovnako ako tmavé štúdiové. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-gradient-to-r from-surface from-35% via-surface/70 to-surface/10"
                  />
                </>
              )}
              <span
                aria-hidden
                className="h-3 w-3 flex-none rounded-full"
                style={{ backgroundColor: SPORT_COLOR[id] }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-foreground">
                  {sport.label}
                </span>
                <span className="truncate text-xs text-muted">
                  {id === "fitness"
                    ? t.fitnessText
                    : live
                      ? sport.domain
                      : t.comingSoon}
                </span>
              </span>
            </>
          );

          return live ? (
            <a
              key={id}
              href={`https://${sport.domain}`}
              className="relative isolate flex min-h-28 items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-foreground/30"
            >
              {body}
            </a>
          ) : (
            <div
              key={id}
              className="relative isolate flex min-h-28 items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-5 opacity-60"
            >
              {body}
            </div>
          );
        })}
      </section>

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
