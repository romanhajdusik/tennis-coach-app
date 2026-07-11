import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type PeriodRangeType = "week" | "month" | "quarter" | "year";

type PlannedData = { date?: string };
type ActualData = { date?: string };

const STROKES_PER_MIN: Record<string, number> = {
  offensive: 25,
  neutral: 23,
  defensive: 20,
};
const BREAK_FACTOR = 0.8; // 20 % z celkového času ide na prestávku

// Return, Serve a GAME DRILLS majú vlastnú frekvenciu úderov odlišnú
// od výmen z dna kurtu — počet úderov sa preto počíta z fixnej sadzby,
// nie podľa charakteru cvičenia.
const FIXED_STROKES_PER_MIN_CATEGORIES: Record<string, number> = {
  Return: 6,
  Serve: 6,
  "GAME DRILLS": 22,
};

const MONTH_LABELS = [
  "Január",
  "Február",
  "Marec",
  "Apríl",
  "Máj",
  "Jún",
  "Júl",
  "August",
  "September",
  "Október",
  "November",
  "December",
];

function isoWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Po=1 .. Ne=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

export function getPeriodRange(
  range: PeriodRangeType,
  value: string,
): { start: Date; end: Date; label: string } {
  if (range === "week") {
    const [yearStr, weekStr] = value.split("-W");
    const year = Number(yearStr);
    const week = Number(weekStr);
    const { start, end } = isoWeekRange(year, week);
    return { start, end, label: `Týždeň ${week}, ${year}` };
  }
  if (range === "month") {
    const [yearStr, monthStr] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end, label: `${MONTH_LABELS[month - 1]} ${year}` };
  }
  if (range === "quarter") {
    const [yearStr, qStr] = value.split("-Q");
    const year = Number(yearStr);
    const quarter = Number(qStr);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 1));
    return { start, end, label: `Q${quarter} ${year}` };
  }
  const year = Number(value);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return { start, end, label: `Rok ${year}` };
}

export function getDefaultPeriodValue(range: PeriodRangeType): string {
  const now = new Date();
  if (range === "week") {
    const { year, week } = getISOWeek(now);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (range === "month") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (range === "quarter") {
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${quarter}`;
  }
  return String(now.getFullYear());
}

export function getPreviousYearValue(
  range: PeriodRangeType,
  value: string,
): string {
  if (range === "week") {
    const [yearStr, weekStr] = value.split("-W");
    return `${Number(yearStr) - 1}-W${weekStr}`;
  }
  if (range === "month") {
    const [yearStr, monthStr] = value.split("-");
    return `${Number(yearStr) - 1}-${monthStr}`;
  }
  if (range === "quarter") {
    const [yearStr, qStr] = value.split("-Q");
    return `${Number(yearStr) - 1}-Q${qStr}`;
  }
  return String(Number(value) - 1);
}

export type CodeStat = {
  code: string;
  minutes: number;
  strokes: number;
  percentage: number;
};

export type CharacterStat = {
  character: string;
  minutes: number;
  percentage: number;
};

export async function getCategoryAnalytics(
  supabase: SupabaseServerClient,
  userId: string,
  category: string,
  start: Date,
  end: Date,
): Promise<{ byCode: CodeStat[]; byCharacter: CharacterStat[] }> {
  const { data: activePlayer } = await supabase
    .from("players")
    .select("id")
    .eq("coach_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!activePlayer) {
    return { byCode: [], byCharacter: [] };
  }

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, planned_data, actual_data")
    .eq("player_id", activePlayer.id);

  const sessionIds = (sessions ?? [])
    .filter((session) => {
      const planned = session.planned_data as PlannedData | null;
      const actual = session.actual_data as ActualData | null;
      const dateStr = actual?.date ?? planned?.date;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= start && date < end;
    })
    .map((session) => session.id);

  if (sessionIds.length === 0) {
    return { byCode: [], byCharacter: [] };
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("character, drill_code, duration_minutes")
    .in("session_id", sessionIds)
    .eq("category", category)
    .eq("status", "played");

  const codeTotals = new Map<string, { minutes: number; strokes: number }>();
  const characterTotals = new Map<string, number>();
  let totalMinutes = 0;

  const fixedStrokesPerMin = FIXED_STROKES_PER_MIN_CATEGORIES[category];

  for (const drill of drills ?? []) {
    const code = drill.drill_code ?? "—";
    const strokesPerMin = fixedStrokesPerMin ?? STROKES_PER_MIN[drill.character] ?? 0;
    const strokes = drill.duration_minutes * BREAK_FACTOR * strokesPerMin;

    const codeEntry = codeTotals.get(code) ?? { minutes: 0, strokes: 0 };
    codeEntry.minutes += drill.duration_minutes;
    codeEntry.strokes += strokes;
    codeTotals.set(code, codeEntry);

    characterTotals.set(
      drill.character,
      (characterTotals.get(drill.character) ?? 0) + drill.duration_minutes,
    );

    totalMinutes += drill.duration_minutes;
  }

  const byCode: CodeStat[] = Array.from(codeTotals.entries())
    .map(([code, { minutes, strokes }]) => ({
      code,
      minutes,
      strokes: Math.round(strokes),
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const byCharacter: CharacterStat[] = Array.from(characterTotals.entries())
    .map(([character, minutes]) => ({
      character,
      minutes,
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return { byCode, byCharacter };
}
