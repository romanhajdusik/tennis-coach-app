"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";
import { CATEGORY_OPTIONS, DRILLS } from "@/lib/drill-options";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SLOT_COUNT = 20;

function isKnownCategory(category: string): boolean {
  return CATEGORY_OPTIONS.includes(category);
}

/**
 * Vlastník kódov cvičení: v org režime organizácia (federačný štandard, §5.5),
 * inak samotný tréner. Kódy sú jadro analytiky, takže obe čítacie funkcie
 * musia filtrovať rovnako — inak by federačný tréner videl predvolený zoznam
 * namiesto štandardu svojej federácie.
 */
async function drillCodeOwnerFilter(userId: string) {
  const org = await getOrgContext();
  return org
    ? { column: "organization_id" as const, value: org.id }
    : { column: "coach_id" as const, value: userId };
}

export async function getDrillCodeSlots(
  supabase: SupabaseServerClient,
  userId: string,
  category: string,
): Promise<string[]> {
  const owner = await drillCodeOwnerFilter(userId);

  const { data } = await supabase
    .from("drill_codes")
    .select("slot, code")
    .eq(owner.column, owner.value)
    .eq("category", category);

  const slots = Array.from({ length: SLOT_COUNT }, () => "");

  if (!data || data.length === 0) {
    const defaults = DRILLS[category] ?? [];
    defaults.forEach((code, index) => {
      if (index < SLOT_COUNT) slots[index] = code;
    });
    return slots;
  }

  for (const row of data) {
    if (row.slot >= 1 && row.slot <= SLOT_COUNT) {
      slots[row.slot - 1] = row.code ?? "";
    }
  }
  return slots;
}

export async function getDrillOptionsByCategory(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<Record<string, string[]>> {
  const owner = await drillCodeOwnerFilter(userId);

  const { data } = await supabase
    .from("drill_codes")
    .select("category, slot, code")
    .eq(owner.column, owner.value)
    .order("slot", { ascending: true });

  const rowsByCategory = new Map<string, { slot: number; code: string | null }[]>();
  for (const row of data ?? []) {
    const rows = rowsByCategory.get(row.category) ?? [];
    rows.push({ slot: row.slot, code: row.code });
    rowsByCategory.set(row.category, rows);
  }

  const result: Record<string, string[]> = {};
  for (const category of CATEGORY_OPTIONS) {
    const rows = rowsByCategory.get(category);
    if (!rows) {
      result[category] = DRILLS[category] ?? [];
      continue;
    }
    result[category] = rows
      .map((row) => row.code?.trim())
      .filter((code): code is string => Boolean(code));
  }
  return result;
}

export type DrillCodesFormState = { error?: string } | undefined;

export async function saveDrillCodes(
  category: string,
  _prevState: DrillCodesFormState,
  formData: FormData,
): Promise<DrillCodesFormState> {
  const t = await getTranslations("DrillCodes.errors");

  if (!isKnownCategory(category)) {
    return { error: t("invalidCategory") };
  }

  const codes = formData.getAll("code").map((value) => (value as string).trim());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // V org režime kódy štandardizuje federácia (§5.5) — tréner ich len používa.
  // RLS by zápis aj tak zamietla; tu vrátime zrozumiteľnú hlášku namiesto
  // technickej chyby.
  const org = await getOrgContext();
  if (org) {
    return { error: t("orgReadOnly") };
  }

  const rows = Array.from({ length: SLOT_COUNT }, (_, index) => ({
    coach_id: user.id,
    category,
    slot: index + 1,
    code: codes[index] || null,
  }));

  const { error } = await supabase
    .from("drill_codes")
    .upsert(rows, { onConflict: "coach_id,category,slot" });

  if (error) {
    return { error: t("saveFailed") };
  }

  revalidatePath("/drill-codes");
  return undefined;
}

/**
 * Uloženie federačného štandardu kódov — jediné miesto, kde má šéftréner
 * zápis (§5.5). Riadky vlastní organizácia (`coach_id` je null), takže sa
 * upsertuje cez `drill_codes_organization_slot`, nie cez trénerov unikát.
 *
 * Prečo to vôbec existuje: bez jednotných kódov by sa agregát v pulte nedal
 * poskladať — každý tréner by mal vlastné a analytika naprieč federáciou by
 * nebola porovnateľná.
 */
export async function saveOrgDrillCodes(
  category: string,
  _prevState: DrillCodesFormState,
  formData: FormData,
): Promise<DrillCodesFormState> {
  const t = await getTranslations("DrillCodes.errors");

  if (!isKnownCategory(category)) {
    return { error: t("invalidCategory") };
  }

  const codes = formData.getAll("code").map((value) => (value as string).trim());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const org = await getOrgContext();
  if (!org || (await getOrgRole(supabase, user.id)) !== "director") {
    return { error: t("orgReadOnly") };
  }

  const rows = Array.from({ length: SLOT_COUNT }, (_, index) => ({
    organization_id: org.id,
    coach_id: null,
    category,
    slot: index + 1,
    code: codes[index] || null,
  }));

  const { error } = await supabase
    .from("drill_codes")
    .upsert(rows, { onConflict: "organization_id,category,slot" });

  if (error) {
    return { error: t("saveFailed") };
  }

  revalidatePath("/director/drill-codes");
  // Tréneri vyberajú kódy pri zázname cvičenia — zmena štandardu sa musí
  // prejaviť aj im.
  revalidatePath("/drill-codes");
  return undefined;
}
