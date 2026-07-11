"use client";

import { useActionState } from "react";
import { saveDrillCodes } from "@/lib/actions/drill-codes";
import { splitSlotsIntoGroups, type AnalyticsCodeGroup } from "@/lib/drill-options";

export function DrillCodeForm({
  category,
  initialSlots,
  groups,
}: {
  category: string;
  initialSlots: string[];
  groups?: AnalyticsCodeGroup[];
}) {
  const saveForCategory = saveDrillCodes.bind(null, category);
  const [state, formAction, pending] = useActionState(
    saveForCategory,
    undefined,
  );

  const buckets = groups ? splitSlotsIntoGroups(initialSlots, groups) : [];

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {category}
      </h2>
      {groups ? (
        <div className="flex gap-3">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {group.label}
              </span>
              {buckets[groupIndex].map((value, i) => (
                <input
                  key={i}
                  name="code"
                  type="text"
                  defaultValue={value}
                  placeholder={`${i + 1}.`}
                  className="w-full min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {initialSlots.map((value, index) => (
            <input
              key={index}
              name="code"
              type="text"
              defaultValue={value}
              placeholder={`${index + 1}.`}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          ))}
        </div>
      )}
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? "Ukladám..." : "Uložiť kódy"}
      </button>
    </form>
  );
}
