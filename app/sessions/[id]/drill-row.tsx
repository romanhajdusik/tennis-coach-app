"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { replaceDrill, setDrillPlayed } from "@/lib/actions/session-drills";
import {
  CATEGORY_OPTIONS,
  CHARACTER_LABELS,
  CHARACTER_OPTIONS,
  DEFAULT_CATEGORY,
  DEFAULT_CHARACTER,
  DURATION_OPTIONS,
} from "@/lib/drill-options";

export type Drill = {
  id: string;
  category: string;
  character: string;
  drill_code: string | null;
  duration_minutes: number;
  status: string;
};

const STATUS_STYLES: Record<string, string> = {
  played:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950",
  not_played: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
  replaced:
    "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
};

function ReplaceDrillForm({
  sessionId,
  drillId,
  drillsByCategory,
  onCancel,
}: {
  sessionId: string;
  drillId: string;
  drillsByCategory: Record<string, string[]>;
  onCancel: () => void;
}) {
  const t = useTranslations("Sessions.drillRow");
  const replaceThisDrill = replaceDrill.bind(null, sessionId, drillId);
  const [state, formAction, pending] = useActionState(
    replaceThisDrill,
    undefined,
  );
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  const drillOptions = drillsByCategory[category];
  const [drillCode, setDrillCode] = useState(drillOptions?.[0] ?? "");

  function handleCategoryChange(value: string) {
    setCategory(value);
    setDrillCode(drillsByCategory[value]?.[0] ?? "");
  }

  return (
    <form
      action={formAction}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <select
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

      <select
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

      {drillOptions && drillOptions.length > 0 ? (
        <select
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
          name="drill_code"
          type="text"
          required
          value={drillCode}
          onChange={(event) => setDrillCode(event.target.value)}
          placeholder={t("drillPlaceholder")}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}

      <select
        name="duration_minutes"
        defaultValue=""
        required
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

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {pending ? t("replaceSubmitPending") : t("replaceSubmit")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

export function DrillRow({
  sessionId,
  drill,
  canEdit,
  drillsByCategory,
}: {
  sessionId: string;
  drill: Drill;
  canEdit: boolean;
  drillsByCategory: Record<string, string[]>;
}) {
  const t = useTranslations("Sessions.drillRow");
  const [isPending, startTransition] = useTransition();
  const [isReplacing, setIsReplacing] = useState(false);

  const statusBadge =
    drill.status === "not_played"
      ? t("statusNotPlayed")
      : drill.status === "replaced"
        ? t("statusReplaced")
        : null;

  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border p-4 ${STATUS_STYLES[drill.status] ?? STATUS_STYLES.played}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {drill.category} · {drill.drill_code}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {CHARACTER_LABELS[drill.character] ?? drill.character}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge && (
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {statusBadge}
            </span>
          )}
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {drill.duration_minutes} min
          </span>
        </div>
      </div>

      {canEdit && drill.status === "played" && !isReplacing && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => setDrillPlayed(sessionId, drill.id, false))
            }
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {t("markNotPlayed")}
          </button>
          <button
            type="button"
            onClick={() => setIsReplacing(true)}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            {t("markReplaced")}
          </button>
        </div>
      )}

      {canEdit && drill.status === "not_played" && (
        <div>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => setDrillPlayed(sessionId, drill.id, true))
            }
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {t("restore")}
          </button>
        </div>
      )}

      {canEdit && drill.status === "played" && isReplacing && (
        <ReplaceDrillForm
          sessionId={sessionId}
          drillId={drill.id}
          drillsByCategory={drillsByCategory}
          onCancel={() => setIsReplacing(false)}
        />
      )}
    </li>
  );
}
