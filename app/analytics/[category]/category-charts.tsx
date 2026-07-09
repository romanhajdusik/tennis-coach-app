"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHARACTER_LABELS } from "@/lib/drill-options";
import type { CharacterStat, CodeStat } from "@/lib/actions/analytics";

const MAX_CODE_SLICES = 7;

// Kategorický poradie farieb je fixné, nikdy sa necykluje/negeneruje —
// posledný slot ("Ostatné") je zámerne šedý, nie ďalší hue, pretože nejde
// o samostatnú identitu, len súhrn zvyšku.
const SERIES_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-other)",
];

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
  payload?: { payload: CodeStat; fill?: string }[];
}) {
  if (!active || !payload?.length) return null;
  const { payload: item, fill } = payload[0];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ backgroundColor: fill }}
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
  payload?: { payload: CharacterStat; fill?: string }[];
}) {
  if (!active || !payload?.length) return null;
  const { payload: item, fill } = payload[0];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-50">
        <span
          className="inline-block h-2 w-4 rounded-full"
          style={{ backgroundColor: fill }}
        />
        {CHARACTER_LABELS[item.character] ?? item.character}
      </div>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        {item.minutes} min · {Math.round(item.percentage)} %
      </p>
    </div>
  );
}

export function CategoryCharts({
  byCode,
  byCharacter,
}: {
  byCode: CodeStat[];
  byCharacter: CharacterStat[];
}) {
  const codeSlices = foldIntoOther(byCode);
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

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Podľa kódu cvičenia — čas, počet úderov, % používania
        </h2>
        <ResponsiveContainer width="100%" height={240}>
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
                <Cell key={entry.code} fill={SERIES_VARS[index]} />
              ))}
            </Pie>
            <Tooltip content={<CodeTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex flex-col gap-1.5 text-sm">
          {codeSlices.map((entry, index) => (
            <li key={entry.code} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: SERIES_VARS[index] }}
              />
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {entry.code}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                — {entry.minutes} min · {entry.strokes} úderov ·{" "}
                {Math.round(entry.percentage)} %
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Podľa charakteru cvičenia
        </h2>
        <ResponsiveContainer width="100%" height={220}>
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
                  fill={characterColors[entry.character] ?? "var(--series-other)"}
                />
              ))}
            </Pie>
            <Tooltip content={<CharacterTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex flex-col gap-1.5 text-sm">
          {byCharacter.map((entry) => (
            <li key={entry.character} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-4 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    characterColors[entry.character] ?? "var(--series-other)",
                }}
              />
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {CHARACTER_LABELS[entry.character] ?? entry.character}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                — {Math.round(entry.percentage)} %
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
