import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getCategoryAnalytics,
  getDefaultPeriodValue,
  getPeriodRange,
  getPreviousYearValue,
  type PeriodRangeType,
} from "@/lib/actions/analytics";
import {
  ANALYTICS_FULL_BREAKDOWN_CATEGORIES,
  ANALYTICS_GROUPED_CATEGORIES,
  CATEGORY_OPTIONS,
} from "@/lib/drill-options";
import { CategoryCharts } from "./category-charts";

const RANGE_OPTIONS: { value: PeriodRangeType; label: string }[] = [
  { value: "week", label: "Týždeň" },
  { value: "month", label: "Mesiac" },
  { value: "quarter", label: "Kvartál" },
  { value: "year", label: "Rok" },
];

function isPeriodRangeType(value: string): value is PeriodRangeType {
  return RANGE_OPTIONS.some((option) => option.value === value);
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
    ? "shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
    : "shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300";
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ range?: string; value?: string }>;
}) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  if (!CATEGORY_OPTIONS.includes(category)) {
    notFound();
  }

  const search = await searchParams;
  const range: PeriodRangeType =
    search.range && isPeriodRangeType(search.range) ? search.range : "month";
  const value = search.value ?? getDefaultPeriodValue(range);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { start, end, label } = getPeriodRange(range, value);
  const { byCode, byCharacter } = await getCategoryAnalytics(
    supabase,
    user.id,
    category,
    start,
    end,
  );
  const previousYearValue = getPreviousYearValue(range, value);

  const periodQuery = (r: PeriodRangeType, v: string) =>
    `range=${r}&value=${encodeURIComponent(v)}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Analytika
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Späť
        </Link>
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((option) => (
          <Link
            key={option}
            href={`/analytics/${encodeURIComponent(option)}?${periodQuery(range, value)}`}
            className={tabClass(option === category)}
          >
            {option}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
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

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="range" value={range} />
          {range === "week" && (
            <input
              type="week"
              name="value"
              defaultValue={value}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
          {range === "month" && (
            <input
              type="month"
              name="value"
              defaultValue={value}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
          {range === "quarter" && (
            <select
              name="value"
              defaultValue={value}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Zobraziť
          </button>
        </form>

        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {label}
          </span>
          <Link
            href={`/analytics/${encodeURIComponent(category)}?${periodQuery(range, previousYearValue)}`}
            className="underline"
          >
            ◀ Minulý rok
          </Link>
        </div>
      </div>

      {byCode.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Žiadne odohrané cvičenia v tomto období.
        </p>
      ) : (
        <CategoryCharts
          byCode={byCode}
          byCharacter={byCharacter}
          fullBreakdown={ANALYTICS_FULL_BREAKDOWN_CATEGORIES.includes(category)}
          groups={ANALYTICS_GROUPED_CATEGORIES[category]}
        />
      )}
    </div>
  );
}
