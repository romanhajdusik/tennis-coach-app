"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";
import type { CodeStat } from "@/lib/actions/analytics";

const MATCH_PREFIX = "MATCH";
const MATCH_COLOR = "var(--series-1)";
const OTHER_COLOR = "var(--series-other)";

type Slice = { label: string; minutes: number; percentage: number };

function PointsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Slice; fill?: string; color?: string }[];
}) {
  const t = useTranslations("Analytics");
  if (!active || !payload?.length) return null;
  const { payload: item, fill, color } = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ backgroundColor: fill ?? color }}
        />
        {item.label}
      </div>
      <p className="mt-1 text-muted">
        {t("characterStatsLine", {
          minutes: item.minutes,
          percentage: Math.round(item.percentage),
        })}
      </p>
    </div>
  );
}

// POINTS: rozdelenie odohraného času na MATCH (zápasové body) vs ostatné
// cvičenia — minutáž a percento. MATCH sa rozpoznáva podľa prefixu kódu
// "MATCH"; ostatné kódy (napr. TRN-PRC, HOM-PRC) spadnú do "Ostatné".
export function PointsChart({ byCode }: { byCode: CodeStat[] }) {
  const t = useTranslations("Analytics");

  const total = byCode.reduce((sum, entry) => sum + entry.minutes, 0);
  const matchMinutes = byCode
    .filter((entry) => entry.code.startsWith(MATCH_PREFIX))
    .reduce((sum, entry) => sum + entry.minutes, 0);
  const otherMinutes = total - matchMinutes;
  const pct = (minutes: number) => (total > 0 ? (minutes / total) * 100 : 0);

  const data: Slice[] = [
    { label: MATCH_PREFIX, minutes: matchMinutes, percentage: pct(matchMinutes) },
    {
      label: t("pointsOtherLabel"),
      minutes: otherMinutes,
      percentage: pct(otherMinutes),
    },
  ];
  const colorOf = (label: string) =>
    label === MATCH_PREFIX ? MATCH_COLOR : OTHER_COLOR;

  return (
    <div className="viz-root flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-muted">
        {t("pointsMatchHeading")}
      </h2>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="minutes"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.label} fill={colorOf(entry.label)} />
            ))}
          </Pie>
          <Tooltip content={<PointsTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-1.5 text-xs">
        {data.map((entry) => (
          <li
            key={entry.label}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              className="inline-block h-2 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: colorOf(entry.label) }}
            />
            <span className="shrink-0 font-medium text-foreground">
              {entry.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted">
              —{" "}
              {t("characterStatsLine", {
                minutes: entry.minutes,
                percentage: Math.round(entry.percentage),
              })}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">{t("pointsTotal", { minutes: total })}</p>
    </div>
  );
}
