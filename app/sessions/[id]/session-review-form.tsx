"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  completeSession,
  deleteSession,
  updateSessionReview,
} from "@/lib/actions/sessions";
import { toLocalInputValue } from "@/lib/datetime-input";

export function SessionReviewForm({
  sessionId,
  status,
  initialDate,
  initialNotes,
  isOrg = false,
}: {
  sessionId: string;
  status: string;
  initialDate?: string;
  initialNotes?: string | null;
  /** Vo federácii sa tréning nemaže, len ruší (§5.4) — a otázka to musí povedať. */
  isOrg?: boolean;
}) {
  const t = useTranslations("Sessions.review");
  const format = useFormatter();
  const updateReviewWithSession = updateSessionReview.bind(null, sessionId);
  const [state, formAction, pending] = useActionState(
    updateReviewWithSession,
    undefined,
  );
  const [isCompleting, startCompleteTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actualDate, setActualDate] = useState(toLocalInputValue(initialDate));

  if (status === "completed") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 ">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted ">
            {t("heading")}
          </h2>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-950 text-red-300">
            {t("completedBadge")}
          </span>
        </div>
        <p className="text-sm text-foreground ">
          {initialDate
            ? format.dateTime(new Date(initialDate), {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : t("noActualDate")}
        </p>
        <p className="text-sm whitespace-pre-wrap text-muted ">
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

  function handleDelete() {
    startDeleteTransition(async () => {
      await deleteSession(sessionId);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 ">
      <h2 className="text-sm font-medium text-muted ">
        {t("heading")}
      </h2>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="actual_date"
            className="text-sm font-medium text-foreground "
          >
            {t("actualDateLabel")}
          </label>
          <input
            id="actual_date"
            type="datetime-local"
            value={actualDate}
            onChange={(event) => setActualDate(event.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          />
          <input
            type="hidden"
            name="actual_date"
            value={actualDate ? new Date(actualDate).toISOString() : ""}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="notes"
            className="text-sm font-medium text-foreground "
          >
            {t("notesLabel")}
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialNotes ?? ""}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 "
        >
          {pending ? t("savingNotes") : t("saveNotes")}
        </button>
      </form>

      {confirmingComplete && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 ">
          <p className="text-sm text-foreground ">
            {t("confirmCompleteMessage")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleComplete}
              disabled={isCompleting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
            >
              {isCompleting ? t("confirmCompleteSubmitPending") : t("confirmCompleteSubmit")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingComplete(false)}
              disabled={isCompleting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 "
            >
              {t("confirmCompleteCancel")}
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="flex flex-col gap-2 rounded-lg border p-3 border-red-800">
          <p className="text-sm text-red-400">
            {t(isOrg ? "confirmCancelMessage" : "confirmDeleteMessage")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 bg-red-700"
            >
              {isDeleting
                ? t("confirmDeleteSubmitPending")
                : t(isOrg ? "confirmCancelSubmit" : "confirmDeleteSubmit")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 "
            >
              {t("confirmDeleteCancel")}
            </button>
          </div>
        </div>
      )}

      {!confirmingComplete && !confirmingDelete && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmingComplete(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("completeButton")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-lg border px-4 py-2 text-sm font-medium border-red-800 text-red-400"
          >
            {t("deleteButton")}
          </button>
        </div>
      )}
    </div>
  );
}
