"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { addDrill, removeDrill } from "@/lib/actions/session-drills";
import {
  CATEGORY_OPTIONS,
  CHARACTER_OPTIONS,
  DEFAULT_CATEGORY,
  DEFAULT_CHARACTER,
  DURATION_OPTIONS,
} from "@/lib/drill-options";

type LastAdded = {
  id: string;
  category: string;
  character: string;
  drillCode: string;
};

export function AddDrillForm({
  sessionId,
  drillsByCategory,
}: {
  sessionId: string;
  drillsByCategory: Record<string, string[]>;
}) {
  const t = useTranslations("Sessions.addDrillForm");
  const addDrillWithSession = addDrill.bind(null, sessionId);
  const [state, formAction] = useActionState(addDrillWithSession, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const processedIdRef = useRef<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  const drillOptions = drillsByCategory[category];
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
      setDrillCode(drillsByCategory[DEFAULT_CATEGORY]?.[0] ?? "");
      setDuration("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleCategoryChange(value: string) {
    setCategory(value);
    setDrillCode(drillsByCategory[value]?.[0] ?? "");
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
            {t("addedPrefix")} {lastAdded.category} · {lastAdded.drillCode}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isRemoving}
            className="rounded-lg border border-emerald-400 px-3 py-1 text-xs font-medium text-emerald-800 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-200"
          >
            {t("undo")}
          </button>
        </div>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {t("heading")}
        </h2>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="category"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("categoryLabel")}
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
            {t("characterLabel")}
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
            {t("drillLabel")}
          </label>
          {drillOptions && drillOptions.length > 0 ? (
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
              placeholder={t("drillPlaceholder")}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="duration_minutes"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("durationLabel")}
          </label>
          <select
            id="duration_minutes"
            name="duration_minutes"
            value={duration}
            onChange={(event) => handleDurationChange(event.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              {t("selectDuration")}
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
