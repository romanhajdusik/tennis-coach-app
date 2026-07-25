"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { createSession } from "@/lib/actions/sessions";

export function NewSessionForm() {
  const t = useTranslations("Sessions.newForm");
  const format = useFormatter();
  const [state, formAction, pending] = useActionState(createSession, undefined);
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("90");
  const [confirming, setConfirming] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 "
    >
      <h2 className="text-sm font-medium text-muted ">
        {t("heading")}
      </h2>

      {!confirming ? (
        <>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="date"
              className="text-sm font-medium text-foreground "
            >
              {t("dateLabel")}
            </label>
            <input
              ref={dateInputRef}
              id="date"
              name="date"
              type="datetime-local"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="duration_minutes"
              className="text-sm font-medium text-foreground "
            >
              {t("durationLabel")}
            </label>
            <select
              id="duration_minutes"
              name="duration_minutes"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            >
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!dateInputRef.current?.reportValidity()) return;
              setConfirming(true);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
          >
            {t("submit")}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 ">
          <p className="text-sm text-foreground ">
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
          <input
            type="hidden"
            name="date"
            value={date ? new Date(date).toISOString() : ""}
          />
          <input type="hidden" name="duration_minutes" value={duration} />
          {state?.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
            >
              {pending ? t("confirmSubmitPending") : t("confirmSubmit")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 "
            >
              {t("confirmEdit")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
