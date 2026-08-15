import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCategoryAnalytics,
  getCategoryMinuteShares,
  getDefaultPeriodValue,
  getPeriodRange,
  getPreviousYearValue,
  type PeriodRangeType,
} from "@/lib/actions/analytics";
import { getDisciplineConfig, showsStrokes } from "@/lib/discipline";
import { PlayerSwitcher } from "@/components/player-switcher";
import { CategoryCharts } from "./category-charts";
import { CategoryShareChart } from "./category-share-chart";

const RANGE_VALUES: PeriodRangeType[] = [
  "last12",
  "week",
  "month",
  "quarter",
  "year",
];

/**
 * Predvolene sa analytika otvára na posledných 12 mesiacoch — kalendárny rok
 * by v januári ukázal takmer prázdne grafy (viď `PeriodRangeType`).
 */
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
    ? "shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground "
    : "shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground ";
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ range?: string; value?: string }>;
}) {
  const discipline = await getDisciplineConfig();
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  if (!discipline.categories.includes(category)) {
    notFound();
  }

  const t = await getTranslations("Analytics");
  const tCommon = await getTranslations("Common");
  const RANGE_OPTIONS: { value: PeriodRangeType; label: string }[] = [
    { value: "last12", label: t("rangeLast12") },
    { value: "week", label: t("rangeWeek") },
    { value: "month", label: t("rangeMonth") },
    { value: "quarter", label: t("rangeQuarter") },
    { value: "year", label: t("rangeYear") },
  ];

  const search = await searchParams;
  const range: PeriodRangeType =
    search.range && isPeriodRangeType(search.range)
      ? search.range
      : DEFAULT_RANGE;
  const value = search.value ?? getDefaultPeriodValue(range);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { start, end, label } = await getPeriodRange(range, value);
  const { byCode, byCharacter } = await getCategoryAnalytics(
    supabase,
    user.id,
    category,
    start,
    end,
  );
  const categoryShares = await getCategoryMinuteShares(
    supabase,
    user.id,
    start,
    end,
  );
  const previousYearValue = getPreviousYearValue(range, value);

  const periodQuery = (r: PeriodRangeType, v: string) =>
    `range=${r}&value=${encodeURIComponent(v)}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-muted underline "
        >
          {tCommon("back")}
        </Link>
      </div>

      <PlayerSwitcher />

      <div className="flex min-w-0 flex-wrap gap-2">
        {discipline.categories.map((option) => (
          <Link
            key={option}
            href={`/analytics/${encodeURIComponent(option)}?${periodQuery(range, value)}`}
            className={tabClass(option === category)}
          >
            {option}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 ">
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={`/analytics/${encodeURIComponent(category)}?${periodQuery(option.value, getDefaultPeriodValue(option.value))}`}
              className={tabClass(option.value === range)}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {/* Kĺzavé okno sa neviaže na konkrétny mesiac či rok, takže nemá čo
            vyberať — je vždy „posledných 12 mesiacov odteraz". Ostatné rozsahy
            si obdobie vyberajú ako doteraz. */}
        {range !== "last12" && (
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="range" value={range} />
          {range === "week" && (
            <input
              type="week"
              name="value"
              defaultValue={value}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            />
          )}
          {range === "month" && (
            <input
              type="month"
              name="value"
              defaultValue={value}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            />
          )}
          {range === "quarter" && (
            <select
              name="value"
              defaultValue={value}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
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
              className="w-24 rounded-lg border border-border px-3 py-2 text-sm bg-input"
            />
          )}
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground "
          >
            {t("show")}
          </button>
        </form>
        )}

        <div className="flex items-center justify-between text-sm text-muted ">
          <span className="font-medium text-foreground ">
            {label}
          </span>
          <Link
            href={`/analytics/${encodeURIComponent(category)}?${periodQuery(range, previousYearValue)}`}
            className="underline"
          >
            {range === "last12" ? t("previousPeriod") : t("previousYear")}
          </Link>
        </div>
      </div>

      {/* Generálny graf ide PRVÝ: najprv „koľko z celkového času padlo na toto
          zameranie", až potom rozpad do kódov a charakteru. */}
      {categoryShares.length > 0 && (
        <CategoryShareChart shares={categoryShares} currentCategory={category} />
      )}

      {byCode.length === 0 ? (
        <p className="text-sm text-muted ">
          {t("noDrillsInPeriod")}
        </p>
      ) : (
        <CategoryCharts
          byCode={byCode}
          byCharacter={byCharacter}
          fullBreakdown={discipline.analytics.fullBreakdownCategories.includes(
            category,
          )}
          groups={discipline.analytics.groupedCategories[category]}
          showStrokes={await showsStrokes(category)}
        />
      )}
    </div>
  );
}
