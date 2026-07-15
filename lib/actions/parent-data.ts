import { createClient } from "@/lib/supabase/server";
import {
  aggregateDrillStats,
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
export async function getParentCategoryAnalytics(
  supabase: SupabaseServerClient,
  parentId: string,
  category: string,
  start: Date,
  end: Date,
): Promise<{ byCode: CodeStat[]; byCharacter: CharacterStat[] }> {
  const { data: records } = await supabase
    .from("parent_session_records")
    .select("id, planned_data, actual_data")
    .eq("parent_id", parentId);

  const recordIds = (records ?? [])
    .filter((record) => {
      const planned = record.planned_data as PlannedData | null;
      const actual = record.actual_data as ActualData | null;
      const dateStr = actual?.date ?? planned?.date;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= start && date < end;
    })
    .map((record) => record.id);

  if (recordIds.length === 0) {
    return { byCode: [], byCharacter: [] };
  }

  const { data: drills } = await supabase
    .from("parent_session_drill_records")
    .select("character, drill_code, duration_minutes")
    .in("parent_record_id", recordIds)
    .eq("category", category)
    .eq("status", "played");

  return aggregateDrillStats(drills ?? [], category);
}
