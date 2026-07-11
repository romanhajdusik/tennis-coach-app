"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHARACTER_LABELS, type AnalyticsCodeGroup } from "@/lib/drill-options";
import type { CharacterStat, CodeStat } from "@/lib/actions/analytics";

type ChartType = "pie" | "bar";

const MAX_CODE_SLICES = 7;
const OTHER_GROUP_LABEL = "Ostatné";

// Kategorický poradie farieb je fixné, nikdy sa necykluje/negeneruje pri
// zbaľovaní do "Ostatné" — posledný slot je zámerne šedý, nie ďalší hue,
// pretože nejde o samostatnú identitu, len súhrn zvyšku. Pri úplnom
// rozpade (fullBreakdown) sa naopak farby cyklicky opakujú, keďže kódov
// môže byť viac než farieb.
const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];
const OTHER_VAR = "var(--series-other)";

function colorAt(index: number): string {
  return SERIES_VARS[index % SERIES_VARS.length];
}

function groupOf(code: string, groups: AnalyticsCodeGroup[]): string {
  return groups.find((group) => code.startsWith(group.prefix))?.label ?? OTHER_GROUP_LABEL;
}

function computeGroupStats(byCode: CodeStat[], groups: AnalyticsCodeGroup[]): CodeStat[] {
  const totals = new Map<string, CodeStat>();
  for (const entry of byCode) {
    const label = groupOf(entry.code, groups);
    const current = totals.get(label) ?? { code: label, minutes: 0, strokes: 0, percentage: 0 };
    current.minutes += entry.minutes;
    current.strokes += entry.strokes;
    current.percentage += entry.percentage;
    totals.set(label, current);
  }
  return groups
    .map((group) => totals.get(group.label))
    .filter((entry): entry is CodeStat => Boolean(entry))
    .concat(totals.has(OTHER_GROUP_LABEL) ? [totals.get(OTHER_GROUP_LABEL)!] : []);
}

function codesInGroup(byCode: CodeStat[], groups: AnalyticsCodeGroup[], groupLabel: string): CodeStat[] {
  return byCode.filter((entry) => groupOf(entry.code, groups) === groupLabel);
}

function foldIntoOther(byCode: CodeStat[]): CodeStat[] {
  if (byCode.length <= MAX_CODE_SLICES) return byCode;
  const top = byCode.slice(0, MAX_CODE_SLICES - 1);
  const rest = byCode.slice(MAX_CODE_SLICES - 1);
  const other: CodeStat = {
    code: "Ostatné",
    minutes: rest.reduce((sum, drill) => sum + drill.minutes, 0),
    strokes: rest.reduce((sum, drill) => sum + drill.strokes, 0),
    percentage: rest.reduce((sum, drill) => sum + drill.percentage, 0),
  };
  return [...top, other];
}

function CodeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CodeStat; fill?: string; color?: string }[];
}) {
  if (!active || !payload?.length) return null;
  const { payload: item, fill, color } = payload[0];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ backgroundColor: fill ?? color }}
        />
        {item.code}
      </div>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {item.minutes} min · {item.strokes} úderov · {Math.round(item.percentage)} %
      </p>
    </div>
  );
}

function CharacterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CharacterStat; fill?: string; color?: string }[];
}) {
  if (!active || !payload?.length) return null;
  const { payload: item, fill, color } = payload[0];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ backgroundColor: fill ?? color }}
        />
        {CHARACTER_LABELS[item.character] ?? item.character}
      </div>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {item.minutes} min · {Math.round(item.percentage)} %
      </p>
    </div>
  );
}

function chartToggleButtonClass(active: boolean) {
  return active
    ? "rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
    : "rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300";
}

function ChartTypeToggle({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (value: ChartType) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => onChange("pie")}
        className={chartToggleButtonClass(value === "pie")}
      >
        Koláč
      </button>
      <button
        type="button"
        onClick={() => onChange("bar")}
        className={chartToggleButtonClass(value === "bar")}
      >
        Stĺpce
      </button>
    </div>
  );
}

export function CategoryCharts({
  byCode,
  byCharacter,
  fullBreakdown,
  groups,
}: {
  byCode: CodeStat[];
  byCharacter: CharacterStat[];
  fullBreakdown: boolean;
  groups?: AnalyticsCodeGroup[];
}) {
  const [codeChartType, setCodeChartType] = useState<ChartType>("pie");
  const [characterChartType, setCharacterChartType] = useState<ChartType>("pie");

  const groupStats = groups ? computeGroupStats(byCode, groups) : [];
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    groupStats[0]?.code,
  );
  const activeGroup = selectedGroup ?? groupStats[0]?.code;
  const groupDetailCodes = groups && activeGroup
    ? codesInGroup(byCode, groups, activeGroup)
    : [];

  const isFoldedView = groups ? true : !fullBreakdown;
  const codeSlices = groups
    ? foldIntoOther(groupDetailCodes)
    : fullBreakdown
      ? byCode
      : foldIntoOther(byCode);
  const codeColors = codeSlices.map((entry, index) =>
    isFoldedView && entry.code === "Ostatné" ? OTHER_VAR : colorAt(index),
  );
  const groupColors = groupStats.map((entry, index) =>
    entry.code === OTHER_GROUP_LABEL ? OTHER_VAR : colorAt(index),
  );

  const characterColors: Record<string, string> = {
    offensive: "var(--series-1)",
    neutral: "var(--series-2)",
    defensive: "var(--series-3)",
  };

  return (
    <div className="viz-root flex flex-col gap-6">
      <style>{`
        .viz-root {
          --surface: #fcfcfb;
          --series-1: #2a78d6;
          --series-2: #1baf7a;
          --series-3: #eda100;
          --series-4: #008300;
          --series-5: #4a3aa7;
          --series-6: #e34948;
          --series-other: #c3c2b7;
        }
        @media (prefers-color-scheme: dark) {
          .viz-root {
            --surface: #1a1a19;
            --series-1: #3987e5;
            --series-2: #199e70;
            --series-3: #c98500;
            --series-4: #008300;
            --series-5: #9085e9;
            --series-6: #e66767;
            --series-other: #52514e;
          }
        }
      `}</style>

      {groups && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Podľa kódu cvičenia — skupiny
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={groupStats} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="code" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CodeTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {groupStats.map((entry, index) => (
                  <Cell
                    key={entry.code}
                    fill={groupColors[index]}
                    opacity={activeGroup === entry.code ? 1 : 0.45}
                    onClick={() => setSelectedGroup(entry.code)}
                    className="cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {groups
              ? `Detail — ${activeGroup}`
              : "Podľa kódu cvičenia — čas, počet úderov, % používania"}
          </h2>
          {fullBreakdown && (
            <ChartTypeToggle value={codeChartType} onChange={setCodeChartType} />
          )}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          {codeChartType === "pie" ? (
            <PieChart>
              <Pie
                data={codeSlices}
                dataKey="minutes"
                nameKey="code"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="var(--surface)"
                strokeWidth={2}
              >
                {codeSlices.map((entry, index) => (
                  <Cell key={entry.code} fill={codeColors[index]} />
                ))}
              </Pie>
              <Tooltip content={<CodeTooltip />} />
            </PieChart>
          ) : (
            <BarChart data={codeSlices} margin={{ top: 8, right: 8, bottom: 32, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="code"
                interval={0}
                angle={-35}
                textAnchor="end"
                height={50}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CodeTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {codeSlices.map((entry, index) => (
                  <Cell key={entry.code} fill={codeColors[index]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
        <ul className="flex flex-col gap-1.5 text-xs">
          {codeSlices.map((entry, index) => (
            <li
              key={entry.code}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <span
                className="inline-block h-2 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: codeColors[index] }}
              />
              <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-50">
                {entry.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-500 dark:text-zinc-400">
                — {entry.minutes} min · {entry.strokes} úderov ·{" "}
                {Math.round(entry.percentage)} %
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Podľa charakteru cvičenia
          </h2>
          {fullBreakdown && (
            <ChartTypeToggle value={characterChartType} onChange={setCharacterChartType} />
          )}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          {characterChartType === "pie" ? (
            <PieChart>
              <Pie
                data={byCharacter}
                dataKey="minutes"
                nameKey="character"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="var(--surface)"
                strokeWidth={2}
              >
                {byCharacter.map((entry) => (
                  <Cell
                    key={entry.character}
                    fill={characterColors[entry.character] ?? OTHER_VAR}
                  />
                ))}
              </Pie>
              <Tooltip content={<CharacterTooltip />} />
            </PieChart>
          ) : (
            <BarChart data={byCharacter} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="character"
                tickFormatter={(value: string) => CHARACTER_LABELS[value] ?? value}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CharacterTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {byCharacter.map((entry) => (
                  <Cell
                    key={entry.character}
                    fill={characterColors[entry.character] ?? OTHER_VAR}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
        <ul className="flex flex-col gap-1.5 text-xs">
          {byCharacter.map((entry) => (
            <li
              key={entry.character}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <span
                className="inline-block h-2 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: characterColors[entry.character] ?? OTHER_VAR,
                }}
              />
              <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-50">
                {CHARACTER_LABELS[entry.character] ?? entry.character}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-500 dark:text-zinc-400">
                — {Math.round(entry.percentage)} %
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
