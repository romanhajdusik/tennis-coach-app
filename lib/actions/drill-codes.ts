"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_OPTIONS, DRILLS } from "@/lib/drill-options";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const SLOT_COUNT = 20;

function isKnownCategory(category: string): boolean {
  return CATEGORY_OPTIONS.includes(category);
}

export async function getDrillCodeSlots(
  supabase: SupabaseServerClient,
  userId: string,
  category: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("drill_codes")
    .select("slot, code")
    .eq("coach_id", userId)
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
  const { data } = await supabase
    .from("drill_codes")
    .select("category, slot, code")
    .eq("coach_id", userId)
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
