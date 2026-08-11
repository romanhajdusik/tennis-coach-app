"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { updateSessionPlan } from "@/lib/actions/sessions";
import { toLocalInputValue } from "@/lib/datetime-input";

const DURATION_OPTIONS = ["60", "90", "120"];

/**
 * Presun naplánovaného tréningu na iný čas. Cvičenia ostávajú, preto sa to
 * ponúka priamo pri plánovanom termíne — nie ako „zrušiť a založiť nanovo".
 *
 * Potvrdzovací medzikrok je rovnaký ako pri plánovaní nového tréningu:
 * appka sa používa na kurte na telefóne, kde je preklep v čase bežný.
 */
export function RescheduleForm({
  sessionId,
  plannedDate,
  plannedDuration,
}: {
  sessionId: string;
  plannedDate?: string;
  plannedDuration?: number;
}) {
  const t = useTranslations("Sessions.reschedule");
  const format = useFormatter();
  const [state, formAction, pending] = useActionState(
    updateSessionPlan.bind(null, sessionId),
    undefined,
  );
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [date, setDate] = useState(toLocalInputValue(plannedDate));
  const [duration, setDuration] = useState(String(plannedDuration ?? 90));
  const dateInputRef = useRef<HTMLInputElement>(null);

  function close() {
    setConfirming(false);
    setOpen(false);
    setDate(toLocalInputValue(plannedDate));
    setDuration(String(plannedDuration ?? 90));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
      >
        {t("button")}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-sm font-medium text-muted">{t("heading")}</h2>

      {!confirming ? (
        <>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="reschedule_date"
              className="text-sm font-medium text-foreground"
            >
              {t("dateLabel")}
            </label>
            <input
              ref={dateInputRef}
              id="reschedule_date"
              type="datetime-local"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="reschedule_duration"
              className="text-sm font-medium text-foreground"
            >
              {t("durationLabel")}
            </label>
            <select
              id="reschedule_duration"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted">{t("hint")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!dateInputRef.current?.reportValidity()) return;
                setConfirming(true);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t("submit")}
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              {t("cancel")}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="text-sm text-foreground">
            {t("confirmMessage", {
              date: date
                ? format.dateTime(new Date(date), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "",
              duration,
            })}
          </p>
          {/* Do DB ide vždy jednoznačný ISO reťazec — prevod z pásma
              zariadenia sa robí tu, v prehliadači (CLAUDE.md, Časové pásmo). */}
          <input
            type="hidden"
            name="date"
            value={date ? new Date(date).toISOString() : ""}
          />
          <input type="hidden" name="duration_minutes" value={duration} />
          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? t("confirmSubmitPending") : t("confirmSubmit")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              {t("confirmEdit")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
