"use client";

import { useActionState, useState } from "react";
import { addDrill } from "@/lib/actions/session-drills";

const CATEGORY_OPTIONS = [
  "Forhand",
  "Backhand",
  "Volley",
  "Return",
  "Servis",
  "Herné cvičenia",
  "Iné",
];

const CHARACTER_OPTIONS = [
  { value: "offensive", label: "Offensive" },
  { value: "neutral", label: "Neutral" },
  { value: "defensive", label: "Defensive" },
];

const DURATION_OPTIONS = [5, 10, 15, 20, 30];

// Kódy cvičení podľa kategórie — zatiaľ vyplnené len pre Forhand,
// ostatné kategórie zatiaľ používajú voľné textové pole
const DRILLS: Record<string, string[]> = {
  Forhand: ["FRH-CRS", "FRH-DTL", "FRH-IOU", "FRH-IIN", "FRH-SLC", "FRH-DRP"],
  Backhand: ["BKH-CRS", "BKH-DTL", "BKH-IOU", "BKH-IIN", "BKH-SLC", "BKH-DRP"],
  Volley: [
    "VOL-FRH",
    "VOL-BKH",
    "VOL-FRH-LOW",
    "VOL-FRH-HGH",
    "VOL-FRH-DRP",
    "VOL-FRH-DRV",
    "VOL-BKH-LOW",
    "VOL-BKH-HGH",
    "VOL-BKH-DRP",
    "VOL-BKH-DRV",
  ],
  Return: [
    "RET-FRH-CRS",
    "RET-FRH-DTL",
    "RET-FRH-MID",
    "RET-FRH-BLC",
    "RET-BKH-CRS",
    "RET-BKH-DTL",
    "RET-BKH-MID",
    "RET-BKH-BLC",
  ],
  Servis: [
    "SR1-DCE-BDY",
    "SR1-DCE-WDE",
    "SR1-DCE-T",
    "SR1-ADV-BDY",
    "SR1-ADV-WDE",
    "SR1-ADV-T",
    "SR2-DCE-BDY",
    "SR2-DCE-WDE",
    "SR2-DCE-T",
    "SR2-ADV-BDY",
    "SR2-ADV-WDE",
    "SR2-ADV-T",
  ],
};

export function AddDrillForm({ sessionId }: { sessionId: string }) {
  const addDrillWithSession = addDrill.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(
    addDrillWithSession,
    undefined,
  );
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const drillOptions = DRILLS[category];

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Pridať cvičenie
      </h2>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="category"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Zameranie
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="character"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Charakter úderu
        </label>
        <select
          id="character"
          name="character"
          defaultValue="neutral"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {CHARACTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="drill_code"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Cvičenie
        </label>
        {drillOptions ? (
          <select
            id="drill_code"
            name="drill_code"
            key={category}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {drillOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="drill_code"
            name="drill_code"
            type="text"
            required
            placeholder="napr. BKH-CRS"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="duration_minutes"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Trvanie
        </label>
        <select
          id="duration_minutes"
          name="duration_minutes"
          defaultValue={10}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? "Pridávam..." : "Pridať cvičenie"}
      </button>
    </form>
  );
}
