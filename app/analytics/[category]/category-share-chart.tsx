"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";
import { CATEGORY_OPTIONS } from "@/lib/drill-options";
import type { CategoryShareStat } from "@/lib/actions/analytics";

// Stabilná farba na zameranie (podľa poradia v CATEGORY_OPTIONS), aby malo
// každé zameranie rovnakú farbu naprieč obdobiami. 7 kategórií = 7 odlíšených
// farieb (6 sérií + neutrálna pre poslednú).
const CATEGORY_COLOR_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-other)",
];

function categoryColor(category: string): string {
  const index = CATEGORY_OPTIONS.indexOf(category);
  return CATEGORY_COLOR_VARS[(index >= 0 ? index : 0) % CATEGORY_COLOR_VARS.length];
}

function ShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CategoryShareStat; fill?: string; color?: string }[];
}) {
  const t = useTranslations("Analytics");
  if (!active || !payload?.length) return null;
  const { payload: item, fill, color } = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm ">
      <div className="flex items-center gap-1.5 font-medium text-foreground ">
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ backgroundColor: fill ?? color }}
        />
        {item.category}
      </div>
      <p className="mt-1 text-muted ">
        {t("characterStatsLine", {
          minutes: item.minutes,
          percentage: Math.round(item.percentage),
        })}
      </p>
    </div>
  );
}

// Generálny graf: percentuálny podiel odohraných minút daného zamerania oproti
// ostatným. Aktuálne zameranie je zvýraznené (plná krytie), ostatné stlmené.
export function CategoryShareChart({
  shares,
  currentCategory,
}: {
  shares: CategoryShareStat[];
  currentCategory: string;
}) {
  const t = useTranslations("Analytics");

  // Aktuálne zameranie je v grafe VŽDY, aj keď v období nemá ani minútu —
  // vtedy sa vypíše s nulou. Bez toho by sa nedalo odlíšiť „toto zameranie
  // sa netrénovalo" od „zameranie tu vôbec nefiguruje" (požiadavka z pultu:
  // pri každom zameraní musí byť generálny graf úplný).
  const data = shares.some((entry) => entry.category === currentCategory)
    ? shares
    : [...shares, { category: currentCategory, minutes: 0, percentage: 0 }];

  // Ak aktuálne zameranie v období nemá žiadne minúty, nezvýrazňujeme nič —
  // graf slúži ako neutrálny prehľad rozloženia (inak by boli stlmené všetky).
  const highlightCurrent = shares.some(
    (entry) => entry.category === currentCategory && entry.minutes > 0,
  );
  const opacityFor = (category: string) =>
    !highlightCurrent || category === currentCategory ? 1 : 0.4;

  return (
    <div className="viz-root flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 ">
      <h2 className="text-sm font-medium text-muted ">
        {t("generalShareHeading")}
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="minutes"
            nameKey="category"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.category}
                fill={categoryColor(entry.category)}
                opacity={opacityFor(entry.category)}
              />
            ))}
          </Pie>
          <Tooltip content={<ShareTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-1.5 text-xs">
        {data.map((entry) => {
          const isCurrent = entry.category === currentCategory;
          return (
            <li
              key={entry.category}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <span
                className="inline-block h-2 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: categoryColor(entry.category),
                  opacity: opacityFor(entry.category),
                }}
              />
              <span
                className={`shrink-0 text-foreground ${
                  isCurrent ? "font-semibold" : "font-medium"
                }`}
              >
                {entry.category}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted ">
                —{" "}
                {t("characterStatsLine", {
                  minutes: entry.minutes,
                  percentage: Math.round(entry.percentage),
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
