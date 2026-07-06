"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { addDrill, removeDrill } from "@/lib/actions/session-drills";

const CATEGORY_OPTIONS = [
  "Forhand",
  "Backhand",
  "Volley",
  "Return",
  "Servis",
  "Herné cvičenia",
  "POINTS",
];

const CHARACTER_OPTIONS = [
  { value: "offensive", label: "Offensive" },
  { value: "neutral", label: "Neutral" },
  { value: "defensive", label: "Defensive" },
];

const DURATION_OPTIONS = [5, 10, 15, 20, 30];

// Kódy cvičení podľa kategórie — kategória bez zoznamu (žiadna zatiaľ)
// by použila voľné textové pole
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
  Servis: ["SR1-DCE", "SR1-ADV", "SR2-DCE", "SR2-ADV"],
  "Herné cvičenia": [
    "RZH-TRE",
    "RZH-ZAP",
    "SR1+1",
    "SR2+1",
    "RET+1",
    "TRI-C+L",
    "TRI-CC+L",
    "TRI-C+LL",
    "TRI-CC+LL",
    "DR8-C+L",
    "DR8-CCL+CC",
    "FRH-ATK+VOL",
    "BKH-ATK+VOL",
    "VOL-PRP+VOL",
    "ATK+VOL+SSH",
  ],
  POINTS: ["TRN-PRC", "HOM-PRC", "MATCH"],
};

const DEFAULT_CATEGORY = CATEGORY_OPTIONS[0];
const DEFAULT_CHARACTER = "neutral";

type LastAdded = {
  id: string;
  category: string;
  character: string;
  drillCode: string;
};

export function AddDrillForm({ sessionId }: { sessionId: string }) {
  const addDrillWithSession = addDrill.bind(null, sessionId);
  const [state, formAction] = useActionState(addDrillWithSession, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const processedIdRef = useRef<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  const drillOptions = DRILLS[category];
  const [drillCode, setDrillCode] = useState(drillOptions?.[0] ?? "");
  const [duration, setDuration] = useState("");
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null);

  useEffect(() => {
    if (state?.addedDrillId && state.addedDrillId !== processedIdRef.current) {
      processedIdRef.current = state.addedDrillId;
      setLastAdded({ id: state.addedDrillId, category, character, drillCode });
      // pripraviť formulár na ďalšie cvičenie
      setCategory(DEFAULT_CATEGORY);
      setCharacter(DEFAULT_CHARACTER);
      setDrillCode(DRILLS[DEFAULT_CATEGORY]?.[0] ?? "");
      setDuration("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleCategoryChange(value: string) {
    setCategory(value);
    setDrillCode(DRILLS[value]?.[0] ?? "");
  }

  function handleDurationChange(value: string) {
    setDuration(value);
    if (value) {
      formRef.current?.requestSubmit();
    }
  }

  function handleUndo() {
    if (!lastAdded) return;
    const toRemove = lastAdded;
    startRemoveTransition(async () => {
      await removeDrill(sessionId, toRemove.id);
    });
    // vrátiť sa pred krok zadania trvania — zameranie/charakter/cvičenie
    // ostávajú vyplnené, len trvanie treba zadať znova
    setCategory(toRemove.category);
    setCharacter(toRemove.character);
    setDrillCode(toRemove.drillCode);
    setDuration("");
    setLastAdded(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {lastAdded && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <span className="text-emerald-800 dark:text-emerald-200">
            Pridané: {lastAdded.category} · {lastAdded.drillCode}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isRemoving}
            className="rounded-lg border border-emerald-400 px-3 py-1 text-xs font-medium text-emerald-800 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-200"
          >
            Undo
          </button>
        </div>
      )}

      <form
        ref={formRef}
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
            onChange={(event) => handleCategoryChange(event.target.value)}
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
            value={character}
            onChange={(event) => setCharacter(event.target.value)}
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
              value={drillCode}
              onChange={(event) => setDrillCode(event.target.value)}
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
              value={drillCode}
              onChange={(event) => setDrillCode(event.target.value)}
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
            value={duration}
            onChange={(event) => handleDurationChange(event.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Vyber trvanie
            </option>
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
      </form>
    </div>
  );
}
