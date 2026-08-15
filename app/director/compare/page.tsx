import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getTimeZone } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { getDirectorDashboard } from "@/lib/org/director";
import {
  getDefaultPeriodValue,
  getPeriodRange,
  getPlayersCategoryAnalytics,
  getPreviousYearValue,
  type PeriodRangeType,
} from "@/lib/actions/analytics";
import { getDisciplineConfig, showsStrokes } from "@/lib/discipline";
import { CategoryCharts } from "@/app/analytics/[category]/category-charts";
import { CategoryShareChart } from "@/app/analytics/[category]/category-share-chart";

const RANGE_VALUES: PeriodRangeType[] = [
  "last12",
  "week",
  "month",
  "quarter",
  "year",
];

/** Rovnaký predvolený rozsah ako všade inde v analytike. */
const DEFAULT_RANGE: PeriodRangeType = "last12";

function isPeriodRangeType(value: string): value is PeriodRangeType {
  return RANGE_VALUES.includes(value as PeriodRangeType);
}

/**
 * Koľko hráčov postaviť vedľa seba. Stĺpce sledujú počet hráčov (dvaja hráči
 * nemajú prečo stáť v šiestich stĺpcoch) a prahy sú nastavené tak, aby stĺpec
 * nikdy neklesol pod ~300 px — pri tejto šírke sa koláč aj legenda („GAME
 * DRILLS — 15 min · 16 %") ešte čítajú.
 *
 * **14" notebook (v CSS 1280–1512 px) tak dostane štyri stĺpce.** Prahy sú
 * odvodené od tohto minima: 4 stĺpce od 1280, 5 od 1600, 6 od 1900.
 *
 * Triedy musia byť napísané doslova, inak ich Tailwind pri builde nenájde.
 * Všetky prahy sú navyše rovnakého druhu (arbitrárny `min-[…]`) — pri miešaní
 * s pomenovanými (`2xl:`) sa CSS pravidlá nezoradia podľa šírky a širší prah
 * prebije užší (overené: 1920 px vracalo 4 stĺpce namiesto 5).
 */
const COLUMN_CLASSES: Record<number, string> = {
  1: "",
  2: "min-[640px]:grid-cols-2",
  3: "min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3",
  4: "min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-4",
  5: "min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-4 min-[1600px]:grid-cols-5",
  6: "min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1280px]:grid-cols-4 min-[1600px]:grid-cols-5 min-[1900px]:grid-cols-6",
};

const MAX_COLUMNS = 6;

function tabClass(active: boolean) {
  return active
    ? "shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
    : "shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground";
}

/**
 * Porovnanie hráčov v riadiacom pulte — tá istá trojica grafov, akú vidí
 * tréner (podiel zameraní, rozpad kódov, charakter), vedľa seba pre celú
 * skupinu naraz.
 *
 * Dve osi zoskupenia: **podľa trénera** („ako pracuje Andrea so svojimi
 * piatimi") a **podľa ročníka** („ako sa pripravuje ročník 2012 naprieč
 * trénermi"). Obe už v dátach existujú (`coach_id`, `birth_year`).
 *
 * Obrazovka je stavaná na laptop/tablet — na širokej ploche stojí vedľa seba
 * viac hráčov, na mobile sa poskladá pod seba.
 */
export default async function DirectorComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    by?: string;
    group?: string;
    category?: string;
    range?: string;
    value?: string;
  }>;
}) {
  const discipline = await getDisciplineConfig();
  const t = await getTranslations("Director.compare");
  const tAnalytics = await getTranslations("Analytics");
  const { supabase, org } = await requireDirector();
  const search = await searchParams;

  const category = search.category
    ? decodeURIComponent(search.category)
    : discipline.defaultCategory;
  if (!discipline.categories.includes(category)) {
    notFound();
  }

  // Vyhodnotené raz, mimo cyklu cez hráčov — `await` sa do `.map()` nezmestí
  // a odpoveď je pre všetky stĺpce rovnaká.
  const showStrokes = await showsStrokes(category);

  const range: PeriodRangeType =
    search.range && isPeriodRangeType(search.range)
      ? search.range
      : DEFAULT_RANGE;
  const value = search.value ?? getDefaultPeriodValue(range);

  const timeZone = await getTimeZone();
  const dashboard = await getDirectorDashboard(supabase, org.id, timeZone);

  // Ročníky, ktoré sa v organizácii reálne vyskytujú (bez „nezadaný").
  const years = [
    ...new Set(
      dashboard.players
        .map((entry) => entry.player.birth_year)
        .filter((year): year is number => year !== null),
    ),
  ].sort((a, b) => b - a);

  const by = search.by === "year" ? "year" : "coach";
  const defaultGroup =
    by === "year"
      ? String(years[0] ?? "")
      : (dashboard.coaches.find((coach) => coach.players.length > 0)?.userId ??
        "");
  const group = search.group ?? defaultGroup;

  const players =
    by === "year"
      ? dashboard.players.filter(
          (entry) => String(entry.player.birth_year ?? "") === group,
        )
      : dashboard.players.filter((entry) => entry.coachId === group);

  const { start, end, label } = await getPeriodRange(range, value);
  const analytics = await getPlayersCategoryAnalytics(
    supabase,
    players.map((entry) => entry.player),
    category,
    start,
    end,
  );

  const query = (next: Partial<Record<string, string>>) => {
    const params = new URLSearchParams({ by, group, category, range, value });
    for (const [key, entry] of Object.entries(next)) {
      if (entry !== undefined) params.set(key, entry);
    }
    return `/director/compare?${params.toString()}`;
  };

  return (
    // Porovnanie ide zámerne širšie než zvyšok pultu — pri piatich-šiestich
    // hráčoch vedľa seba je každý pixel šírky stĺpec navyše.
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-[150rem] flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <Link
          href="/director"
          className="flex-none text-sm font-medium text-muted underline"
        >
          {t("back")}
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            {t("byCoach")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {dashboard.coaches
              .filter((coach) => coach.userId)
              .map((coach) => (
                <Link
                  key={coach.userId}
                  href={query({ by: "coach", group: coach.userId as string })}
                  className={tabClass(by === "coach" && group === coach.userId)}
                >
                  {coach.name}
                </Link>
              ))}
          </div>
        </div>

        {years.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("byYear")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <Link
                  key={year}
                  href={query({ by: "year", group: String(year) })}
                  className={tabClass(by === "year" && group === String(year))}
                >
                  {t("yearLabel", { year })}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        {discipline.categories.map((option) => (
          <Link
            key={option}
            href={query({ category: option })}
            className={tabClass(option === category)}
          >
            {option}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "last12", label: tAnalytics("rangeLast12") },
              { value: "week", label: tAnalytics("rangeWeek") },
              { value: "month", label: tAnalytics("rangeMonth") },
              { value: "quarter", label: tAnalytics("rangeQuarter") },
              { value: "year", label: tAnalytics("rangeYear") },
            ] as { value: PeriodRangeType; label: string }[]
          ).map((option) => (
            <Link
              key={option.value}
              href={query({
                range: option.value,
                value: getDefaultPeriodValue(option.value),
              })}
              className={tabClass(option.value === range)}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="font-medium text-foreground">{label}</span>
          <Link
            href={query({ value: getPreviousYearValue(range, value) })}
            className="underline"
          >
            {range === "last12"
              ? tAnalytics("previousPeriod")
              : tAnalytics("previousYear")}
          </Link>
        </div>
      </div>

      {/* items-start: hráč bez dát v období nesmie natiahnuť svoju kartu na
          výšku celého riadka. */}
      {players.length === 0 ? (
        <p className="text-sm text-muted">{t("groupEmpty")}</p>
      ) : (
        <div
          className={`grid grid-cols-1 items-start gap-4 ${
            COLUMN_CLASSES[Math.min(players.length, MAX_COLUMNS)]
          }`}
        >
          {players.map((entry) => {
            const stats = analytics.get(entry.player.id);
            return (
              <section
                key={entry.player.id}
                className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/director/players/${entry.player.id}`}
                    className="min-w-0 truncate font-medium text-foreground underline"
                  >
                    {entry.player.name}
                  </Link>
                  {entry.player.birth_year && (
                    <span className="flex-none text-xs text-muted">
                      {entry.player.birth_year}
                    </span>
                  )}
                </div>

                {/* Generálny graf ide prvý a vykreslí sa vždy, keď hráč
                    v období vôbec trénoval — aj keď práve toto zameranie nemá
                    ani minútu (vypíše sa v ňom s nulou). Rozpad kódov sa
                    prirodzene ukáže až vtedy, keď je čo rozpadať. */}
                {stats && stats.shares.length > 0 && (
                  <CategoryShareChart
                    shares={stats.shares}
                    currentCategory={category}
                  />
                )}

                {!stats || stats.byCode.length === 0 ? (
                  <p className="text-sm text-muted">{t("playerNoData")}</p>
                ) : (
                  <CategoryCharts
                    byCode={stats.byCode}
                    byCharacter={stats.byCharacter}
                    fullBreakdown={discipline.analytics.fullBreakdownCategories.includes(
                      category,
                    )}
                    groups={discipline.analytics.groupedCategories[category]}
                    showStrokes={showStrokes}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
