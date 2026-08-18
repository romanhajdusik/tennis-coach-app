import { createClient } from "@/lib/supabase/server";
import { getDisciplineConfig } from "@/lib/discipline";
import {
  ageStrokeFactor,
  aggregateCategoryShares,
  aggregateDrillStats,
  type CategoryShareStat,
  type CharacterStat,
  type CodeStat,
} from "@/lib/actions/analytics";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type PlannedData = { date?: string };
type ActualData = { date?: string };

// Read-only obdoba lib/actions/analytics.ts#getCategoryAnalytics, len nad
// trvalou kópiou dát rodiča (parent_session_records/
// parent_session_drill_records) namiesto živých sessions/session_drills —
// pozri CLAUDE.md sekciu o zdieľaní pre vysvetlenie prečo.
// Id skopírovaných tréningov v období — zdieľané oboma analytickými dotazmi
// nižšie (podľa reálneho, inak plánovaného dátumu, ako u trénera).
async function getParentRecordIdsInPeriod(
  supabase: SupabaseServerClient,
  parentId: string,
  start: Date,
  end: Date,
): Promise<string[]> {
  // Dotaz je ohraničený obdobím, nie na celú históriu — bez toho narazí
  // dlhá história na `max_rows` PostgRESTu a analytika by ticho počítala
  // len z časti tréningov. Okraje sú o dva dni širšie kvôli časovému
  // pásmu, presné orezanie robí až porovnanie nižšie (ako v kalendári).
  //
  // **Strop (`limit`) sem zámerne nepatrí:** oreznutý riadok by nespôsobil
  // chýbajúcu položku v zozname, ale NESPRÁVNE ČÍSLO v grafe. Hranicou je
  // okno, nie počet.
  const margin = 2 * 24 * 60 * 60 * 1000;
  const from = new Date(start.getTime() - margin).toISOString();
  const to = new Date(end.getTime() + margin).toISOString();

  const { data: records } = await supabase
    .from("parent_session_records")
    .select("id, planned_data, actual_data")
    .eq("parent_id", parentId)
    .or(
      `and(planned_data->>date.gte.${from},planned_data->>date.lt.${to}),` +
        `and(actual_data->>date.gte.${from},actual_data->>date.lt.${to})`,
    );

  return (records ?? [])
    .filter((record) => {
      const planned = record.planned_data as PlannedData | null;
      const actual = record.actual_data as ActualData | null;
      const dateStr = actual?.date ?? planned?.date;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= start && date < end;
    })
    .map((record) => record.id);
}

export async function getParentCategoryAnalytics(
  supabase: SupabaseServerClient,
  parentId: string,
  category: string,
  start: Date,
  end: Date,
): Promise<{ byCode: CodeStat[]; byCharacter: CharacterStat[] }> {
  const recordIds = await getParentRecordIdsInPeriod(
    supabase,
    parentId,
    start,
    end,
  );

  if (recordIds.length === 0) {
    return { byCode: [], byCharacter: [] };
  }

  const { data: drills } = await supabase
    .from("parent_session_drill_records")
    .select("character, drill_code, duration_minutes")
    .in("parent_record_id", recordIds)
    .eq("category", category)
    .eq("status", "played");

  // Odhad úderov znižujeme podľa veku hráča rovnako ako u trénera. Rodič
  // vidí ročník aktívne pripojeného hráča priamo cez RLS policy
  // players_select_connected_parent, takže netreba snapshot na strane kópie.
  const birthYear = await getConnectedPlayerBirthYear(supabase, parentId);

  return aggregateDrillStats(
    drills ?? [],
    category,
    await getDisciplineConfig(),
    ageStrokeFactor(birthYear),
  );
}

/**
 * Generálny graf pre rodiča/hráča/manažéra — podiel jednotlivých zameraní na
 * celkovom odohranom čase. Rovnaký pohľad, aký má tréner: kto tréningy sleduje,
 * má vidieť to isté rozloženie.
 */
export async function getParentCategoryMinuteShares(
  supabase: SupabaseServerClient,
  parentId: string,
  start: Date,
  end: Date,
): Promise<CategoryShareStat[]> {
  const recordIds = await getParentRecordIdsInPeriod(
    supabase,
    parentId,
    start,
    end,
  );

  if (recordIds.length === 0) {
    return [];
  }

  const { data: drills } = await supabase
    .from("parent_session_drill_records")
    .select("category, duration_minutes")
    .in("parent_record_id", recordIds)
    .eq("status", "played");

  return aggregateCategoryShares(drills ?? []);
}

// Ročník aktívne pripojeného hráča daného rodiča/hráča/manažéra. Číta sa
// z players (nie z kópie) — RLS policy players_select_connected_parent to
// pri aktívnom prepojení povoľuje. Bez aktívneho prepojenia vráti null
// (odhad úderov sa potom nekráti).
async function getConnectedPlayerBirthYear(
  supabase: SupabaseServerClient,
  parentId: string,
): Promise<number | null> {
  const { data: connection } = await supabase
    .from("player_connections")
    .select("player_id")
    .eq("parent_id", parentId)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return null;
  }

  const { data: player } = await supabase
    .from("players")
    .select("birth_year")
    .eq("id", connection.player_id)
    .maybeSingle();

  return player?.birth_year ?? null;
}
