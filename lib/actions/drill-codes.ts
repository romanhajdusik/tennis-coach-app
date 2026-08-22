"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";
import {
  getDisciplineConfig,
  isCategoryOfAnyDiscipline,
  type DisciplineConfig,
} from "@/lib/discipline";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Počet slotov je rovnaký v každej disciplíne (tenis aj kondička 20).
const SLOT_COUNT = 20;

async function isKnownCategory(category: string): Promise<boolean> {
  return (await getDisciplineConfig()).categories.includes(category);
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

/**
 * `discipline` sa dá podať zvonka: šéftréner nastavuje štandard aj pre
 * disciplínu, ktorú sám nerobí, takže predvolené kódy sa nesmú brať z jeho
 * vlastnej konfigurácie — dostal by prázdno.
 */
export async function getDrillCodeSlots(
  supabase: SupabaseServerClient,
  userId: string,
  category: string,
  discipline?: DisciplineConfig,
): Promise<string[]> {
  const owner = await drillCodeOwnerFilter(userId);

  const { data } = await supabase
    .from("drill_codes")
    .select("slot, code")
    .eq(owner.column, owner.value)
    .eq("category", category);

  const slots = Array.from({ length: SLOT_COUNT }, () => "");

  if (!data || data.length === 0) {
    const defaults = (discipline ?? (await getDisciplineConfig())).drills[
      category
    ] ?? [];
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

  const discipline = await getDisciplineConfig();
  const result: Record<string, string[]> = {};
  for (const category of discipline.categories) {
    const rows = rowsByCategory.get(category);
    if (!rows) {
      result[category] = discipline.drills[category] ?? [];
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

  if (!(await isKnownCategory(category))) {
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

  // **Jediná zapisovacia akcia BEZ `requireWriteAccess`** (rozhodnuté
  // 2026-08-21) — a je to zámer, nie prehliadnutie. Tréner si kódy nastaví aj
  // bez predplatného, takže po zaplatení má appku pripravenú podľa seba od
  // prvej sekundy. Personalizácia kódov je zároveň hlavný sľub landingu
  // („zapíš si vlastné drily"); za platobnou stenou by pôsobila ako návnada.
  //
  // Prečo je to bezpečné: kódy sú vlastníctvo trénera, počet je zhora
  // ohraničený (20 slotov na zameranie), nič sa nimi nezverejňuje a analytika
  // z nich nepočíta nič, kým nevznikne tréning — a ten bez predplatného
  // nevznikne. Neplatiaci účet si teda vie appku nachystať, ale nie ju
  // používať.

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

  // Šéftréner štandardizuje kódy pre OBE disciplíny — jeho vlastná (tenis)
  // by kondičné zamerania zamietla.
  if (!isCategoryOfAnyDiscipline(category)) {
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
