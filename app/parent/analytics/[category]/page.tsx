import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultPeriodValue,
  getPeriodRange,
  getPreviousYearValue,
  type PeriodRangeType,
} from "@/lib/actions/analytics";
import { getParentCategoryAnalytics } from "@/lib/actions/parent-data";
import {
  ANALYTICS_FULL_BREAKDOWN_CATEGORIES,
  ANALYTICS_GROUPED_CATEGORIES,
  ANALYTICS_MATCH_SPLIT_CATEGORIES,
  CATEGORY_OPTIONS,
} from "@/lib/drill-options";
import { CategoryCharts } from "@/app/analytics/[category]/category-charts";
import { PointsChart } from "@/app/analytics/[category]/points-chart";

const RANGE_VALUES: PeriodRangeType[] = ["week", "month", "quarter", "year"];

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

export default async function ParentAnalyticsPage({
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

  const t = await getTranslations("Analytics");
  const tParent = await getTranslations("Parent.calendar");
  const RANGE_OPTIONS: { value: PeriodRangeType; label: string }[] = [
    { value: "week", label: t("rangeWeek") },
    { value: "month", label: t("rangeMonth") },
    { value: "quarter", label: t("rangeQuarter") },
    { value: "year", label: t("rangeYear") },
  ];

  const search = await searchParams;
  const range: PeriodRangeType =
    search.range && isPeriodRangeType(search.range) ? search.range : "month";
  const value = search.value ?? getDefaultPeriodValue(range);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  const { data: connection } = await supabase
    .from("player_connections")
    .select("id")
    .eq("parent_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const { start, end, label } = await getPeriodRange(range, value);
  const { byCode, byCharacter } = connection
    ? await getParentCategoryAnalytics(supabase, user.id, category, start, end)
    : { byCode: [], byCharacter: [] };
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
          href="/parent"
          className="text-sm font-medium text-muted underline "
        >
          {tParent("back")}
        </Link>
      </div>

      {!connection ? (
        <p className="text-sm text-muted ">
          {tParent("noConnection")}
        </p>
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => (
              <Link
                key={option}
                href={`/parent/analytics/${encodeURIComponent(option)}?${periodQuery(range, value)}`}
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
                  href={`/parent/analytics/${encodeURIComponent(category)}?${periodQuery(option.value, getDefaultPeriodValue(option.value))}`}
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

            <div className="flex items-center justify-between text-sm text-muted ">
              <span className="font-medium text-foreground ">
                {label}
              </span>
              <Link
                href={`/parent/analytics/${encodeURIComponent(category)}?${periodQuery(range, previousYearValue)}`}
                className="underline"
              >
                {t("previousYear")}
              </Link>
            </div>
          </div>

          {byCode.length === 0 ? (
            <p className="text-sm text-muted ">
              {t("noDrillsInPeriod")}
            </p>
          ) : ANALYTICS_MATCH_SPLIT_CATEGORIES.includes(category) ? (
            <PointsChart byCode={byCode} />
          ) : (
            <CategoryCharts
              byCode={byCode}
              byCharacter={byCharacter}
              fullBreakdown={ANALYTICS_FULL_BREAKDOWN_CATEGORIES.includes(category)}
              groups={ANALYTICS_GROUPED_CATEGORIES[category]}
            />
          )}
        </>
      )}
    </div>
  );
}
