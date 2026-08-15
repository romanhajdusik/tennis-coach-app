"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTranslations } from "next-intl";
import { useDiscipline } from "@/lib/discipline-context";
import type { DisciplineConfig } from "@/lib/discipline";
import type { CategoryShareStat } from "@/lib/actions/analytics";

// Stabilná farba na zameranie (podľa jeho poradia v konfigurácii disciplíny),
// aby malo každé zameranie rovnakú farbu naprieč obdobiami. Tenis má 7 zameraní
// = 7 odlíšených farieb (6 sérií + neutrálna pre posledné).
//
// POZOR: kondička má 10 zameraní, takže sa jej farby cez modulo opakujú —
// paleta sa dopĺňa v `globals.css` v Kroku 2.
const CATEGORY_COLOR_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-other)",
];

function categoryColor(category: string, categories: string[]): string {
  const index = categories.indexOf(category);
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
//
// Ten istý komponent kreslí aj prehľad DRUHEJ disciplíny dole na stránke
// (krok 5) — vtedy dostane jej konfiguráciu propom a `currentCategory` je
// `null`. Preto sú obe veci, ktoré by inak bral z kontextu, prepísateľné:
// **zoznam zameraní** (určuje farby a ich poradie — z tenisového zoznamu by
// kondičné zamerania vypadli jednofarebné) a **podoba grafu** (kondička má
// 10 zameraní, tie musia byť stĺpce). Bez toho by sa musel klonovať.
export function CategoryShareChart({
  shares,
  currentCategory,
  config,
  heading,
}: {
  shares: CategoryShareStat[];
  /** `null` = žiadne zvýraznené zameranie (prehľad cudzej disciplíny). */
  currentCategory: string | null;
  /** Konfigurácia disciplíny týchto dát; bez nej platí disciplína appky. */
  config?: Pick<DisciplineConfig, "categories" | "analytics">;
  heading?: string;
}) {
  const t = useTranslations("Analytics");
  const ownDiscipline = useDiscipline();
  const discipline = config ?? ownDiscipline;
  const title = heading ?? t("generalShareHeading");

  // Aktuálne zameranie je v grafe VŽDY, aj keď v období nemá ani minútu —
  // vtedy sa vypíše s nulou. Bez toho by sa nedalo odlíšiť „toto zameranie
  // sa netrénovalo" od „zameranie tu vôbec nefiguruje" (požiadavka z pultu:
  // pri každom zameraní musí byť generálny graf úplný).
  //
  // Pri cudzej disciplíne sa NEDOPĹŇA nič: „aktuálne zameranie" tam žiadne
  // nie je a dopísané by bolo duchom s nulou, ktorý v cudzích dátach nemá čo
  // hľadať.
  const data =
    currentCategory === null ||
    shares.some((entry) => entry.category === currentCategory)
      ? shares
      : [...shares, { category: currentCategory, minutes: 0, percentage: 0 }];

  // Ak aktuálne zameranie v období nemá žiadne minúty, nezvýrazňujeme nič —
  // graf slúži ako neutrálny prehľad rozloženia (inak by boli stlmené všetky).
  const highlightCurrent = shares.some(
    (entry) => entry.category === currentCategory && entry.minutes > 0,
  );
  const opacityFor = (category: string) =>
    !highlightCurrent || category === currentCategory ? 1 : 0.4;

  // Disciplína s viacerými zameraniami, než unesie paleta (kondička má 10),
  // ich vykreslí ako vodorovné stĺpce — identitu tam nesie popis, nie farba.
  if (discipline.analytics.shareChart === "bars") {
    return (
      <div className="viz-root flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted">
          {title}
        </h2>
        <ul className="flex flex-col gap-2.5">
          {data.map((entry) => {
            const isCurrent = entry.category === currentCategory;
            return (
              <li key={entry.category} className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`min-w-0 truncate text-xs text-foreground ${
                      isCurrent ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {entry.category}
                  </span>
                  <span className="flex-none text-xs text-muted">
                    {t("characterStatsLine", {
                      minutes: entry.minutes,
                      percentage: Math.round(entry.percentage),
                    })}
                  </span>
                </div>
                {/* Dráha ukazuje celok, výplň podiel — stĺpce tak držia
                    spoločnú stovku aj pri zameraní s nulou. */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-input">
                  <div
                    className="h-2 rounded-r-full"
                    style={{
                      width: `${entry.percentage}%`,
                      backgroundColor: "var(--series-1)",
                      opacity: opacityFor(entry.category),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

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
                fill={categoryColor(entry.category, discipline.categories)}
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
                  backgroundColor: categoryColor(entry.category, discipline.categories),
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
