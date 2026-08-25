import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPlayer } from "@/lib/players/selected";
import { getLinkedPlayerId } from "@/lib/players/linked";
import {
  getDiscipline,
  getDisciplineConfig,
  disciplineConfig,
  disciplineOfCategory,
  type DisciplineConfig,
  type DisciplineId,
} from "@/lib/discipline";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * `last12` = **posledných 12 celých mesiacov**, predvolený rozsah analytiky.
 *
 * Kalendárny `year` ako predvolený nefunguje: v januári by tréner otvoril
 * analytiku a videl takmer prázdne grafy. Kĺzavé okno ukáže vždy plnú sezónu.
 *
 * Okno je zarovnané na celé mesiace (nie „365 dní dozadu"), aby sa dalo
 * čitateľne pomenovať a porovnávať. `value` je kotva `YYYY-MM` = **posledný**
 * mesiac okna vrátane; aktuálny mesiac je teda rozpracovaný, čo je zámer.
 */
export type PeriodRangeType = "week" | "month" | "quarter" | "year" | "last12";

/** Počet mesiacov v kĺzavom okne `last12`. */
const ROLLING_MONTHS = 12;

function monthAnchor(value: string): { year: number; month: number } {
  const [yearStr, monthStr] = value.split("-");
  return { year: Number(yearStr), month: Number(monthStr) };
}

/** Posunie kotvu `YYYY-MM` o zadaný počet mesiacov (Date si poradí s pretečením). */
function shiftMonthValue(value: string, byMonths: number): string {
  const { year, month } = monthAnchor(value);
  const shifted = new Date(Date.UTC(year, month - 1 + byMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

type PlannedData = { date?: string };
type ActualData = { date?: string };

// Sadzby úderov aj prestávkový faktor sú vlastnosťou disciplíny
// (`lib/disciplines/*`) — kondička odhad úderov nepočíta vôbec a má
// `strokes: null`, takže sa v analytike zobrazí len čas a %.

// Odhad úderov sa u mladších hráčov znižuje — deti a juniori majú kratšie
// a pomalšie výmeny, takže odhad odvodený z dospelej sadzby by ich preceňoval.
// Stupňovito podľa veku (z players.birth_year), najmladšia hranica má prednosť:
//   vek < 13 → −20 %, < 15 → −15 %, < 17 → −10 %, 17+ (alebo ročník neznámy) → bez zmeny.
// Vek = aktuálny rok − ročník narodenia (v DB máme len ročník, nie presný dátum).
export function ageStrokeFactor(birthYear: number | null | undefined): number {
  if (!birthYear) return 1;
  const age = new Date().getFullYear() - birthYear;
  if (age < 13) return 0.8;
  if (age < 15) return 0.85;
  if (age < 17) return 0.9;
  return 1;
}

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

export async function getPeriodRange(
  range: PeriodRangeType,
  value: string,
): Promise<{ start: Date; end: Date; label: string }> {
  const t = await getTranslations("Analytics");
  const monthLabels = t.raw("months") as string[];

  if (range === "week") {
    const [yearStr, weekStr] = value.split("-W");
    const year = Number(yearStr);
    const week = Number(weekStr);
    const { start, end } = isoWeekRange(year, week);
    return { start, end, label: t("weekLabel", { week, year }) };
  }
  if (range === "month") {
    const [yearStr, monthStr] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { start, end, label: `${monthLabels[month - 1]} ${year}` };
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
  if (range === "last12") {
    // Kotva je posledný mesiac okna vrátane, takže koniec je prvý deň
    // NASLEDUJÚCEHO mesiaca a začiatok o 11 mesiacov skôr (11, nie 12 —
    // kotvový mesiac sa počíta tiež).
    const { year, month } = monthAnchor(value);
    const start = new Date(Date.UTC(year, month - ROLLING_MONTHS, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const from = `${monthLabels[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
    const to = `${monthLabels[month - 1]} ${year}`;
    return { start, end, label: `${from} – ${to}` };
  }

  const year = Number(value);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return { start, end, label: t("yearLabel", { year }) };
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
  if (range === "last12") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  if (range === "last12") {
    // Predošlé okno = 12 mesiacov TESNE PRED aktuálnym, nie ten istý mesiac
    // vlani. Inak by sa obe okná prekrývali v 11 mesiacoch a porovnanie by
    // nemalo výpovednú hodnotu.
    return shiftMonthValue(value, -ROLLING_MONTHS);
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

export type CategoryShareStat = {
  category: string;
  minutes: number;
  percentage: number;
};

type DrillForStats = {
  // `null` v disciplíne, ktorá charakter nezaznamenáva (kondička).
  character: string | null;
  drill_code: string | null;
  duration_minutes: number;
};

// Zdieľané s lib/actions/parent-data.ts — rovnaká agregácia sa počíta aj
// nad kópiou dát v parent_session_drill_records, len s inak získaným
// zoznamom drills.
// Disciplína ide dnu ako PARAMETER, nie cez `getDisciplineConfig()`: agregát je
// zdieľaný engine a nesmie siahať na globálny stav. Pult šéftrénera navyše
// počíta aj nad disciplínou, ktorú sám „nerobí" — tam je jediná správna
// konfigurácia tá zo štítku tréningu, nie z jeho členstva.
export function aggregateDrillStats(
  drills: DrillForStats[],
  category: string,
  discipline: DisciplineConfig,
  strokeFactor = 1,
): { byCode: CodeStat[]; byCharacter: CharacterStat[] } {
  const codeTotals = new Map<string, { minutes: number; strokes: number }>();
  const characterTotals = new Map<string, number>();
  let totalMinutes = 0;

  const { character: characterConfig, analytics } = discipline;
  const strokesConfig = analytics.strokes;
  const fixedStrokesPerMin = strokesConfig?.fixedPerMinByCategory[category];

  for (const drill of drills) {
    const code = drill.drill_code ?? "—";

    let strokes = 0;
    if (strokesConfig) {
      const strokesPerMin =
        fixedStrokesPerMin ??
        (drill.character
          ? (strokesConfig.perMinByCharacter[drill.character] ?? 0)
          : 0);
      strokes =
        drill.duration_minutes *
        strokesConfig.breakFactor *
        strokesPerMin *
        strokeFactor;
    }

    const codeEntry = codeTotals.get(code) ?? { minutes: 0, strokes: 0 };
    codeEntry.minutes += drill.duration_minutes;
    codeEntry.strokes += strokes;
    codeTotals.set(code, codeEntry);

    // Rozpad podľa charakteru dáva zmysel len tam, kde sa charakter zapisuje —
    // inak by vznikol jediný výsek s prázdnym kľúčom.
    if (characterConfig && drill.character) {
      characterTotals.set(
        drill.character,
        (characterTotals.get(drill.character) ?? 0) + drill.duration_minutes,
      );
    }

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

// Podiel jednotlivých zameraní na celkovom odohranom čase — vstup pre
// "generálny" graf v analytike (dané zameranie oproti ostatným).
export function aggregateCategoryShares(
  drills: { category: string; duration_minutes: number }[],
): CategoryShareStat[] {
  const totals = new Map<string, number>();
  let totalMinutes = 0;

  for (const drill of drills) {
    totals.set(
      drill.category,
      (totals.get(drill.category) ?? 0) + drill.duration_minutes,
    );
    totalMinutes += drill.duration_minutes;
  }

  return Array.from(totals.entries())
    .map(([category, minutes]) => ({
      category,
      minutes,
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

// Id tréningov daného hráča spadajúce do obdobia (podľa reálneho, inak
// plánovaného dátumu). Kto hráča smie vidieť, rieši RLS — trénerovi vráti
// len jeho pridelených, šéftrénerovi ktoréhokoľvek hráča organizácie.
//
// **Disciplína je povinný parameter a filtruje sa v SQL** (docs §2.0, krok 4).
// Odkedy tréner vidí aj cudziu disciplínu — vo federácii cez priradenie, mimo
// nej cez prepojenie kariet — by sa bez tohto filtra kondičné minúty ticho
// primiešali do percent tenisových zameraní. Je to poistka na najnižšom
// spoločnom mieste: prejde ňou trénerova analytika, pult aj porovnanie.
export async function getPlayerSessionIdsInPeriod(
  supabase: SupabaseServerClient,
  playerId: string,
  start: Date,
  end: Date,
  discipline: DisciplineId,
): Promise<string[]> {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, planned_data, actual_data")
    .eq("player_id", playerId)
    .eq("discipline", discipline);

  return (sessions ?? [])
    .filter((session) => {
      const planned = session.planned_data as PlannedData | null;
      const actual = session.actual_data as ActualData | null;
      const dateStr = actual?.date ?? planned?.date;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= start && date < end;
    })
    .map((session) => session.id);
}

// Zdieľané pre analytické dotazy trénera: to isté, ale pre práve vybraného
// hráča (lib/players/selected.ts je jediný zdroj pravdy, kto to je).
async function getActivePlayerSessionIdsInPeriod(
  supabase: SupabaseServerClient,
  userId: string,
  start: Date,
  end: Date,
): Promise<{ sessionIds: string[]; birthYear: number | null }> {
  const activePlayer = await getSelectedPlayer(supabase, userId);

  if (!activePlayer) {
    return { sessionIds: [], birthYear: null };
  }

  return {
    // Tréner analyzuje vždy vlastnú disciplínu — tú cudziu vidí v kalendári,
    // ale do jeho čísel nepatrí.
    sessionIds: await getPlayerSessionIdsInPeriod(
      supabase,
      activePlayer.id,
      start,
      end,
      await getDiscipline(),
    ),
    birthYear: activePlayer.birth_year,
  };
}

/**
 * Analytika konkrétneho hráča — rovnaký výpočet ako trénerova, len hráč sa
 * zadáva priamo (riadiaci pult šéftrénera sa pozerá na hráčov, ktorých sám
 * „vybraných" nemá). Prístup stráži RLS, nie tento parameter.
 */
export async function getPlayerCategoryAnalytics(
  supabase: SupabaseServerClient,
  player: { id: string; birth_year: number | null },
  category: string,
  start: Date,
  end: Date,
): Promise<{ byCode: CodeStat[]; byCharacter: CharacterStat[] }> {
  // Pult analyzuje disciplínu ZAMERANIA, na ktoré sa práve pozerá — sám
  // žiadnu „nerobí" a hráč môže mať tréningy oboch.
  //
  // **Tou istou disciplínou sa musí aj počítať**, nielen filtrovať: sadzby
  // úderov, charakter aj zoskupenia kódov sú jej vlastnosťou. Šéftrénerovi by
  // inak appka pri kondičnom zameraní dopočítala tenisový odhad úderov —
  // kondička ho nemá mať vôbec.
  const analysed = await analysedDiscipline(category);
  const sessionIds = await getPlayerSessionIdsInPeriod(
    supabase,
    player.id,
    start,
    end,
    analysed,
  );

  if (sessionIds.length === 0) {
    return { byCode: [], byCharacter: [] };
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("character, drill_code, duration_minutes")
    .in("session_id", sessionIds)
    .eq("category", category)
    .eq("status", "played");

  return aggregateDrillStats(
    drills ?? [],
    category,
    disciplineConfig(analysed),
    ageStrokeFactor(player.birth_year),
  );
}

export type PlayerAnalytics = {
  byCode: CodeStat[];
  byCharacter: CharacterStat[];
  shares: CategoryShareStat[];
};

/**
 * Analytika viacerých hráčov naraz — porovnanie skupiny v riadiacom pulte
 * (všetci hráči jedného trénera, celý ročník…).
 *
 * Zámerne **dva dotazy pre celú skupinu**, nie štyri na hráča: pri desiatich
 * hráčoch by sa inak posielalo 40 dotazov a stránka by sa vliekla. Výpočet je
 * ten istý zdieľaný agregát, takže čísla sedia s trénerovou analytikou.
 */
export async function getPlayersCategoryAnalytics(
  supabase: SupabaseServerClient,
  players: { id: string; birth_year: number | null }[],
  category: string,
  start: Date,
  end: Date,
): Promise<Map<string, PlayerAnalytics>> {
  const empty: PlayerAnalytics = { byCode: [], byCharacter: [], shares: [] };
  const result = new Map<string, PlayerAnalytics>(
    players.map((player) => [player.id, empty]),
  );

  if (players.length === 0) {
    return result;
  }

  // Aj tu sa filtruje disciplína zamerania: porovnanie stavia stĺpce vedľa
  // seba a jeden hráč s kondičnou prípravou by inak mal iné percentá než
  // ostatní bez toho, aby to bolo z grafu vidieť.
  const analysed = await analysedDiscipline(category);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, player_id, planned_data, actual_data")
    .in(
      "player_id",
      players.map((player) => player.id),
    )
    .eq("discipline", analysed);

  const playerBySession = new Map<string, string>();
  for (const session of sessions ?? []) {
    const planned = session.planned_data as PlannedData | null;
    const actual = session.actual_data as ActualData | null;
    const dateStr = actual?.date ?? planned?.date;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (date < start || date >= end) continue;
    playerBySession.set(session.id, session.player_id);
  }

  if (playerBySession.size === 0) {
    return result;
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("session_id, category, character, drill_code, duration_minutes")
    .in("session_id", [...playerBySession.keys()])
    .eq("status", "played");

  const drillsByPlayer = new Map<string, typeof drills>();
  for (const drill of drills ?? []) {
    const playerId = playerBySession.get(drill.session_id);
    if (!playerId) continue;
    drillsByPlayer.set(playerId, [...(drillsByPlayer.get(playerId) ?? []), drill]);
  }

  // Konfigurácia tej istej disciplíny, akou sa filtrovalo — inak by sa
  // kondičným zameraniam dopočítal tenisový odhad úderov.
  const discipline = disciplineConfig(analysed);

  for (const player of players) {
    const own = drillsByPlayer.get(player.id) ?? [];
    const { byCode, byCharacter } = aggregateDrillStats(
      own.filter((drill) => drill.category === category),
      category,
      discipline,
      ageStrokeFactor(player.birth_year),
    );
    result.set(player.id, {
      byCode,
      byCharacter,
      shares: aggregateCategoryShares(own),
    });
  }

  return result;
}

/**
 * Podiel zameraní na odohranom čase konkrétneho hráča (pult, drill-in).
 *
 * Disciplína je povinná: generálny graf počíta podiel na CELKOVOM čase, takže
 * je to presne to miesto, kde by primiešané kondičné minúty prepísali všetky
 * percentá naraz.
 */
export async function getPlayerCategoryMinuteShares(
  supabase: SupabaseServerClient,
  playerId: string,
  start: Date,
  end: Date,
  discipline: DisciplineId,
): Promise<CategoryShareStat[]> {
  const sessionIds = await getPlayerSessionIdsInPeriod(
    supabase,
    playerId,
    start,
    end,
    discipline,
  );

  if (sessionIds.length === 0) {
    return [];
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("category, duration_minutes")
    .in("session_id", sessionIds)
    .eq("status", "played");

  return aggregateCategoryShares(drills ?? []);
}

/**
 * Ktorou disciplínou sa má analyzovať toto zameranie.
 *
 * Zameranie je jediné, čo o disciplíne v pulte hovorí — šéftréner žiadnu
 * „nerobí" a hráč môže mať tréningy oboch. Mimo pultu vyjde to isté ako
 * disciplína appky, takže je bezpečné použiť to všade rovnako.
 */
async function analysedDiscipline(category: string): Promise<DisciplineId> {
  return disciplineOfCategory(category) ?? (await getDiscipline());
}

/**
 * Podiely zameraní v DRUHEJ disciplíne za to isté obdobie — vstup pre kondičný
 * prehľad dole v tenisovej analytike (docs §2.0, krok 5).
 *
 * **Vlastná stovka je celý dôvod, prečo je to samostatný blok.** Kondičné
 * minúty sa nesmú dostať do `CategoryShareChart` — ten počíta podiel na
 * celkovom čase, takže by ticho prepísali percentá všetkých tenisových
 * zameraní naraz. Tu majú vlastný súčet a tenisové čísla ostávajú nedotknuté.
 *
 * Odkiaľ sa čítajú, závisí od režimu, a rozdiel je schovaný tu:
 * mimo federácie je druhá disciplína INÁ KARTA (prepojenie kódom), vo
 * federácii tá istá karta s druhým priradením. RLS vydá jedno aj druhé.
 *
 * **Tretia cesta je súhrn OPAČNÝM smerom** (docs §2.3): vydávajúca strana na
 * cudzie tréningy prístup nemá vôbec a čísla dostane hotové z agregujúcej
 * funkcie. Preto sa tu graf plní z dvoch rôznych zdrojov — nie sú zameniteľné a
 * ani nemajú byť: tam vidieť detail, späť len súčty.
 *
 * `null` = nie je čo kresliť (žiadne prepojenie alebo v období nič), a vtedy
 * sa blok nevykreslí vôbec — prázdny graf by len zaberal miesto.
 */
export async function getLinkedDisciplineShares(
  supabase: SupabaseServerClient,
  userId: string,
  start: Date,
  end: Date,
): Promise<{ discipline: DisciplineId; shares: CategoryShareStat[] } | null> {
  const player = await getSelectedPlayer(supabase, userId);

  if (!player) {
    return null;
  }

  const mine = await getDiscipline();
  const other: DisciplineId = mine === "tennis" ? "fitness" : "tennis";
  const sourcePlayerId =
    (await getLinkedPlayerId(supabase, player.id)) ?? player.id;

  const shares = await getPlayerCategoryMinuteShares(
    supabase,
    sourcePlayerId,
    start,
    end,
    other,
  );

  if (shares.length > 0) {
    return { discipline: other, shares };
  }

  // Opačný smer (docs §2.3): kto kód VYDAL, dostane naspäť súhrn — ale len
  // vtedy, keď mu druhá strana prepla súhlas. Skúša sa až tu, lebo vo federácii
  // sa cudzia disciplína číta cestou vyššie a tam by RPC aj tak nič nevrátilo.
  //
  // Podmienka je konfiguračná, nie „ak je to kondička": súhrn smie prísť len
  // vydávajúcej strane a to isté sa pýta aj funkcia v databáze
  // (`source_coach_id = auth.uid()`).
  if ((await getDisciplineConfig()).cardLink !== "owner") {
    return null;
  }

  const { data: summary } = await supabase.rpc(
    "linked_player_category_minutes",
    {
      p_player_id: player.id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    },
  );

  if (!summary || summary.length === 0) {
    return null;
  }

  return { discipline: other, shares: aggregateCategoryShares(summary) };
}

export async function getCategoryAnalytics(
  supabase: SupabaseServerClient,
  userId: string,
  category: string,
  start: Date,
  end: Date,
): Promise<{ byCode: CodeStat[]; byCharacter: CharacterStat[] }> {
  const { sessionIds, birthYear } = await getActivePlayerSessionIdsInPeriod(
    supabase,
    userId,
    start,
    end,
  );

  if (sessionIds.length === 0) {
    return { byCode: [], byCharacter: [] };
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("character, drill_code, duration_minutes")
    .in("session_id", sessionIds)
    .eq("category", category)
    .eq("status", "played");

  return aggregateDrillStats(
    drills ?? [],
    category,
    await getDisciplineConfig(),
    ageStrokeFactor(birthYear),
  );
}

// Podiel všetkých zameraní na celkovom odohranom čase v období (naprieč
// kategóriami) — pre generálny graf na stránke ktoréhokoľvek zamerania.
export async function getCategoryMinuteShares(
  supabase: SupabaseServerClient,
  userId: string,
  start: Date,
  end: Date,
): Promise<CategoryShareStat[]> {
  const { sessionIds } = await getActivePlayerSessionIdsInPeriod(
    supabase,
    userId,
    start,
    end,
  );

  if (sessionIds.length === 0) {
    return [];
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("category, duration_minutes")
    .in("session_id", sessionIds)
    .eq("status", "played");

  return aggregateCategoryShares(drills ?? []);
}
