"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { completeSession, updateSessionReview } from "@/lib/actions/sessions";

function toLocalInputValue(date: string | undefined) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function SessionReviewForm({
  sessionId,
  status,
  initialDate,
  initialNotes,
}: {
  sessionId: string;
  status: string;
  initialDate?: string;
  initialNotes?: string | null;
}) {
  const t = useTranslations("Sessions.review");
  const format = useFormatter();
  const updateReviewWithSession = updateSessionReview.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(
    updateReviewWithSession,
    undefined,
  );
  const [isCompleting, startCompleteTransition] = useTransition();
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  if (status === "completed") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t("heading")}
          </h2>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {t("completedBadge")}
          </span>
        </div>
        <p className="text-sm text-zinc-900 dark:text-zinc-50">
          {initialDate
            ? format.dateTime(new Date(initialDate), {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : t("noActualDate")}
        </p>
        <p className="text-sm whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
          {initialNotes || t("noNotes")}
        </p>
      </div>
    );
  }

  function handleComplete() {
    startCompleteTransition(async () => {
      await completeSession(sessionId);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t("heading")}
      </h2>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="actual_date"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("actualDateLabel")}
          </label>
          <input
            id="actual_date"
            name="actual_date"
            type="datetime-local"
            defaultValue={toLocalInputValue(initialDate)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="notes"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {t("notesLabel")}
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialNotes ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50"
        >
          {pending ? t("savingNotes") : t("saveNotes")}
        </button>
      </form>

      {confirmingComplete ? (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {t("confirmCompleteMessage")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleComplete}
              disabled={isCompleting}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {isCompleting ? t("confirmCompleteSubmitPending") : t("confirmCompleteSubmit")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingComplete(false)}
              disabled={isCompleting}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {t("confirmCompleteCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingComplete(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          {t("completeButton")}
        </button>
      )}
    </div>
  );
}
