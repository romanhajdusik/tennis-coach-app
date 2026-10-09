"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveDrillCodes, saveOrgDrillCodes } from "@/lib/actions/drill-codes";
import { splitSlotsIntoGroups, type AnalyticsCodeGroup } from "@/lib/drill-options";
import type { DisciplineId } from "@/lib/disciplines/types";
import { DrillGlossaryList, type DrillGuide } from "@/components/drill-glossary";

export function DrillCodeForm({
  category,
  initialSlots,
  groups,
  guide = null,
  readOnly = false,
  organizationDiscipline,
}: {
  category: string;
  initialSlots: string[];
  groups?: AnalyticsCodeGroup[];
  /** Vysvetlivky ku kódom zamerania (`drillGuide`); `null` = nevykreslia sa. */
  guide?: DrillGuide | null;
  /** V org režime kódy nastavuje šéftréner federácie — tréner ich len číta (§5.5). */
  readOnly?: boolean;
  /**
   * Zadaná = ukladá sa štandard ORGANIZÁCIE pre túto disciplínu (šéftréner,
   * ktorý sám žiadnu „nerobí"). Bez nej trénerove osobné kódy v disciplíne
   * jeho appky.
   */
  organizationDiscipline?: DisciplineId;
}) {
  const t = useTranslations("DrillCodes");
  const saveForCategory = organizationDiscipline
    ? saveOrgDrillCodes.bind(null, organizationDiscipline, category)
    : saveDrillCodes.bind(null, category);
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
      {/* Zbalené, aby formulár ostal krátky — kto skratkám rozumie, nemusí
          ich prechádzať pri každom otvorení stránky. */}
      {guide && (
        <details className="rounded-lg border border-border bg-background/40 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {guide.kind === "defaults" ? t("glossaryToggle") : t("examplesToggle")}
          </summary>
          <div className="flex flex-col gap-2 pt-2">
            {/* Veta je povinná (rozhodol user 2026-10-09): kódy sú len
                začiatok, každý tréner si cvičenia pomenuje po svojom. */}
            <p className="text-xs leading-5 text-muted">
              {guide.kind === "defaults" ? t("glossaryNote") : t("examplesNote")}
            </p>
            <DrillGlossaryList entries={guide.entries} />
          </div>
        </details>
      )}
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
                  readOnly={readOnly}
                  disabled={readOnly}
                  className="w-full min-w-0 rounded-lg border border-border px-3 py-2 text-sm bg-input disabled:opacity-70"
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
              readOnly={readOnly}
              disabled={readOnly}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input disabled:opacity-70"
            />
          ))}
        </div>
      )}
      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      {!readOnly && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
        >
          {pending ? t("saving") : t("save")}
        </button>
      )}
    </form>
  );
}
