"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("DrillCodes");
  const saveForCategory = saveDrillCodes.bind(null, category);
  const [state, formAction, pending] = useActionState(
    saveForCategory,
    undefined,
  );

  const buckets = groups ? splitSlotsIntoGroups(initialSlots, groups) : [];

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 "
    >
      <h2 className="text-sm font-medium text-foreground ">
        {category}
      </h2>
      {groups ? (
        <div className="flex gap-3">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-xs font-medium text-muted ">
                {group.label}
              </span>
              {buckets[groupIndex].map((value, i) => (
                <input
                  key={i}
                  name="code"
                  type="text"
                  defaultValue={value}
                  placeholder={`${i + 1}.`}
                  className="w-full min-w-0 rounded-lg border border-border px-3 py-2 text-sm bg-input"
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
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            />
          ))}
        </div>
      )}
      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
