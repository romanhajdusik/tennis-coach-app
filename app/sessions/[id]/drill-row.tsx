"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { moveDrill, replaceDrill, setDrillPlayed } from "@/lib/actions/session-drills";
import { getDisciplineConfig } from "@/lib/discipline";

const DISCIPLINE = getDisciplineConfig();
// Prázdny reťazec v disciplíne bez charakteru — pole sa vtedy nevykreslí.
const DEFAULT_CHARACTER = DISCIPLINE.character?.defaultValue ?? "";

export type Drill = {
  id: string;
  category: string;
  character: string;
  drill_code: string | null;
  duration_minutes: number;
  status: string;
  sort_order: number;
};

const STATUS_STYLES: Record<string, string> = {
  played:
    " border-emerald-900 bg-emerald-950",
  not_played: " border-red-900 bg-red-950",
  replaced:
    " border-yellow-900 bg-yellow-950",
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
  const [category, setCategory] = useState(DISCIPLINE.defaultCategory);
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
      className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 "
    >
      <select
        name="category"
        value={category}
        onChange={(event) => handleCategoryChange(event.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
      >
        {DISCIPLINE.categories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {DISCIPLINE.character && (
        <select
          name="character"
          value={character}
          onChange={(event) => setCharacter(event.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
        >
          {DISCIPLINE.character.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {drillOptions && drillOptions.length > 0 ? (
        <select
          name="drill_code"
          value={drillCode}
          onChange={(event) => setDrillCode(event.target.value)}
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
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
          className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
        />
      )}

      <select
        name="duration_minutes"
        defaultValue=""
        required
        className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
      >
        <option value="" disabled>
          {t("selectDuration")}
        </option>
        {DISCIPLINE.durations.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes} min
          </option>
        ))}
      </select>

      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 "
        >
          {pending ? t("replaceSubmitPending") : t("replaceSubmit")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground "
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
  isFirst,
  isLast,
}: {
  sessionId: string;
  drill: Drill;
  canEdit: boolean;
  drillsByCategory: Record<string, string[]>;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTranslations("Sessions.drillRow");
  const [isPending, startTransition] = useTransition();
  const [isMoving, startMoveTransition] = useTransition();
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
        <div className="flex items-center gap-2">
          {canEdit && (
            <div className="flex flex-col">
              <button
                type="button"
                disabled={isMoving || isFirst}
                onClick={() =>
                  startMoveTransition(() => moveDrill(sessionId, drill.id, "up"))
                }
                aria-label={t("moveUp")}
                className="px-1 leading-none text-muted disabled:opacity-25 "
              >
                ▲
              </button>
              <button
                type="button"
                disabled={isMoving || isLast}
                onClick={() =>
                  startMoveTransition(() => moveDrill(sessionId, drill.id, "down"))
                }
                aria-label={t("moveDown")}
                className="px-1 leading-none text-muted disabled:opacity-25 "
              >
                ▼
              </button>
            </div>
          )}
          <div>
            <p className="font-medium text-foreground ">
              {drill.category} · {drill.drill_code}
            </p>
            {DISCIPLINE.character && (
              <p className="text-sm text-muted ">
                {DISCIPLINE.character.labels[drill.character] ?? drill.character}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge && (
            <span className="text-xs font-medium text-muted ">
              {statusBadge}
            </span>
          )}
          <span className="text-sm font-medium text-muted ">
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
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground disabled:opacity-50 "
          >
            {t("markNotPlayed")}
          </button>
          <button
            type="button"
            onClick={() => setIsReplacing(true)}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground "
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
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground disabled:opacity-50 "
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
