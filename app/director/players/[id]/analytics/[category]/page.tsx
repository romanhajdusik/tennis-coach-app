import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import {
  getDefaultPeriodValue,
  getPeriodRange,
  getPlayerCategoryAnalytics,
  getPlayerCategoryMinuteShares,
  getPreviousYearValue,
  type PeriodRangeType,
} from "@/lib/actions/analytics";
import {
  disciplineConfig,
  disciplineOfCategory,
  showsStrokesIn,
  type DisciplineId,
} from "@/lib/discipline";

/** Obe disciplíny v pevnom poradí — kurt prvý, je to hlavná os federácie. */
const ALL_DISCIPLINES: DisciplineId[] = ["tennis", "fitness"];
import { CategoryCharts } from "@/app/analytics/[category]/category-charts";
import { CategoryShareChart } from "@/app/analytics/[category]/category-share-chart";

const RANGE_VALUES: PeriodRangeType[] = [
  "last12",
  "week",
  "month",
  "quarter",
  "year",
];

/** Rovnaký predvolený rozsah ako v trénerovej analytike. */
const DEFAULT_RANGE: PeriodRangeType = "last12";

function isPeriodRangeType(value: string): value is PeriodRangeType {
  return RANGE_VALUES.includes(value as PeriodRangeType);
}

function quarterOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { value: string; label: string }[] = [];
  for (let year = currentYear - 2; year <= currentYear + 1; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      options.push({ value: `${year}-Q${quarter}`, label: `Q${quarter} ${year}` });
    }
  }
  return options;
}

function tabClass(active: boolean) {
  return active
    ? "shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
    : "shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground";
}

/**
 * Analytika hráča očami šéftrénera. Počíta ju **ten istý** agregát ako
 * trénerovi (`aggregateDrillStats`), takže čísla v pulte a v trénerovej appke
 * sa nemôžu rozísť — to je aj dôvod, prečo kódy cvičení v B2B štandardizuje
 * federácia (§5.5): bez jednotných kódov by rozpad nebol porovnateľný.
 */
export default async function DirectorPlayerAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; category: string }>;
  searchParams: Promise<{ range?: string; value?: string }>;
}) {
  const { id, category: rawCategory } = await params;
  // Next.js v tomto projekte dynamické segmenty nedekóduje — bez toho by
  // kategória s medzerou („GAME DRILLS", „CORE MUSCLES") nikdy nesedela.
  const category = decodeURIComponent(rawCategory);

  // **Pult sa neriadi disciplínou appky, ale zameraním, ktoré si šéftréner
  // otvoril.** Sám žiadnu disciplínu „nerobí" (vidí obe) a hráč môže mať
  // tréningy oboch, takže `getDisciplineConfig()` by tu bola nesprávna
  // odpoveď: kondičné zameranie by odmietla ako neznáme a kondičným dátam by
  // dopočítala tenisové sadzby úderov.
  const viewedId = disciplineOfCategory(category);
  if (!viewedId) {
    notFound();
  }
  const discipline = disciplineConfig(viewedId);

  const t = await getTranslations("Analytics");
  const tPlayer = await getTranslations("Director.player");
  const { supabase, org } = await requireDirector();

  const { data: player } = await supabase
    .from("players")
    .select("id, name, birth_year, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!player || player.organization_id !== org.id) {
    notFound();
  }

  const search = await searchParams;
  const range: PeriodRangeType =
    search.range && isPeriodRangeType(search.range)
      ? search.range
      : DEFAULT_RANGE;
  const value = search.value ?? getDefaultPeriodValue(range);

  const { start, end, label } = await getPeriodRange(range, value);
  const { byCode, byCharacter } = await getPlayerCategoryAnalytics(
    supabase,
    player,
    category,
    start,
    end,
  );
  // Generálny graf musí počítať nad tou istou disciplínou ako rozpad vedľa
  // neho — hráč môže mať aj kondičné tréningy a percentá by sa rozišli.
  const categoryShares = await getPlayerCategoryMinuteShares(
    supabase,
    player.id,
    start,
    end,
    disciplineOfCategory(category) ?? "tennis",
  );
  const previousYearValue = getPreviousYearValue(range, value);

  const basePath = `/director/players/${player.id}/analytics`;
  const periodQuery = (r: PeriodRangeType, v: string) =>
    `range=${r}&value=${encodeURIComponent(v)}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">
            {player.name}
          </h1>
          <p className="text-sm text-muted">{t("title")}</p>
        </div>
        <Link
          href={`/director/players/${player.id}`}
          className="flex-none text-sm font-medium text-muted underline"
        >
          {tPlayer("back")}
        </Link>
      </div>

      {/* Prepínač disciplíny — pult je jediné miesto, kde treba. Tréner má
          disciplínu jednu (z nasadenia alebo z členstva), šéftréner obe,
          a bez tejto voľby by sa ku kondičným zameraniam nedostal vôbec.
          Prepnutie vedie na PRVÉ zameranie druhej disciplíny, obdobie sa
          zachová — porovnáva sa tým istým oknom. */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_DISCIPLINES.map((option) => {
          const config = disciplineConfig(option);
          return (
            <Link
              key={option}
              href={`${basePath}/${encodeURIComponent(config.defaultCategory)}?${periodQuery(range, value)}`}
              className={tabClass(option === viewedId)}
            >
              {config.label}
            </Link>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        {discipline.categories.map((option) => (
          <Link
            key={option}
            href={`${basePath}/${encodeURIComponent(option)}?${periodQuery(range, value)}`}
            className={tabClass(option === category)}
          >
            {option}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "last12", label: t("rangeLast12") },
              { value: "week", label: t("rangeWeek") },
              { value: "month", label: t("rangeMonth") },
              { value: "quarter", label: t("rangeQuarter") },
              { value: "year", label: t("rangeYear") },
            ] as { value: PeriodRangeType; label: string }[]
          ).map((option) => (
            <Link
              key={option.value}
              href={`${basePath}/${encodeURIComponent(category)}?${periodQuery(option.value, getDefaultPeriodValue(option.value))}`}
              className={tabClass(option.value === range)}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {/* Kĺzavé okno nemá čo vyberať — je vždy „posledných 12 mesiacov". */}
        {range !== "last12" && (
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="range" value={range} />
          {range === "week" && (
            <input
              type="week"
              name="value"
              defaultValue={value}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          )}
          {range === "month" && (
            <input
              type="month"
              name="value"
              defaultValue={value}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          )}
          {range === "quarter" && (
            <select
              name="value"
              defaultValue={value}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              {quarterOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {range === "year" && (
            <input
              type="number"
              name="value"
              defaultValue={value}
              className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          )}
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground"
          >
            {t("show")}
          </button>
        </form>
        )}

        <div className="flex items-center justify-between text-sm text-muted">
          <span className="font-medium text-foreground">{label}</span>
          <Link
            href={`${basePath}/${encodeURIComponent(category)}?${periodQuery(range, previousYearValue)}`}
            className="underline"
          >
            {range === "last12" ? t("previousPeriod") : t("previousYear")}
          </Link>
        </div>
      </div>

      {/* Na laptope stoja grafy vedľa seba (pult je stavaný na širokú plochu),
          na mobile pod sebou. Generálny graf ide PRVÝ — rovnaké poradie ako
          v trénerovej analytike. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* Grafy dostávajú konfiguráciu PREZERANEJ disciplíny propom — inak by
            si ju vzali z kontextu, kde je disciplína nasadenia (tenis), a
            kondičné zamerania by dostali koláč so siedmimi farbami namiesto
            stĺpcov, tenisový charakter a odhad úderov, ktorý kondička nemá. */}
        {categoryShares.length > 0 && (
          <CategoryShareChart
            shares={categoryShares}
            currentCategory={category}
            config={discipline}
          />
        )}

        {byCode.length === 0 ? (
          <p className="text-sm text-muted">{t("noDrillsInPeriod")}</p>
        ) : (
          <CategoryCharts
            byCode={byCode}
            byCharacter={byCharacter}
            fullBreakdown={discipline.analytics.fullBreakdownCategories.includes(
              category,
            )}
            groups={discipline.analytics.groupedCategories[category]}
            showStrokes={showsStrokesIn(discipline, category)}
            character={discipline.character}
          />
        )}
      </div>
    </div>
  );
}
