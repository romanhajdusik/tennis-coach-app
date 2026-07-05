"use client";

import { useActionState } from "react";
import { createSession } from "@/lib/actions/sessions";

export function NewSessionForm() {
  const [state, formAction, pending] = useActionState(createSession, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Naplánovať tréning
      </h2>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="date"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Dátum a čas
        </label>
        <input
          id="date"
          name="date"
          type="datetime-local"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="focus"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Zameranie
        </label>
        <input
          id="focus"
          name="focus"
          type="text"
          required
          placeholder="napr. forhend, servis, kondícia"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="duration_minutes"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Trvanie (minúty)
        </label>
        <input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={1}
          required
          defaultValue={60}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? "Ukladám..." : "Naplánovať"}
      </button>
    </form>
  );
}
