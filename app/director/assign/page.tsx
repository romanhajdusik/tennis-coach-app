import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { BulkAssignForm } from "@/app/director/coach-assignment";
import {
  disciplineConfig,
  isCourtDiscipline,
  isDisciplineId,
} from "@/lib/disciplines/registry";
import { getColleagueNames } from "@/lib/org/colleagues";

/**
 * Hromadné priradenie trénerov (rozhodol user 2026-10-12): v zväzoch má bežne
 * skupina 2–3 trénerov na starosti 6–10 hráčov a po jednom by to bolo 30
 * kliknutí. Zaškrtnúť hráčov, zaškrtnúť trénerov, jeden krok.
 *
 * Pomenované skupiny zámerne nie sú — zoznam hráčov tu ukazuje ročník aj
 * súčasných trénerov, čo na výber skupiny stačí.
 */
export default async function DirectorAssignPage() {
  const t = await getTranslations("Director.bulk");
  const tDirector = await getTranslations("Director");
  const { supabase, org } = await requireDirector();

  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name, birth_year")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: assignmentRows } = await supabase
    .from("player_assignments")
    .select("player_id, coach_id")
    .eq("organization_id", org.id);

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id, discipline")
    .eq("organization_id", org.id)
    .eq("role", "coach")
    .eq("status", "active");

  const names = await getColleagueNames(supabase);
  const nameOf = (userId: string) => names.get(userId) || "—";
  const sport = disciplineConfig(org.courtDiscipline).label;

  const coaches = (members ?? [])
    .filter((member): member is { user_id: string; discipline: string } =>
      Boolean(member.user_id),
    )
    .map((member) => ({
      userId: member.user_id,
      name: nameOf(member.user_id),
      disciplineLabel:
        isDisciplineId(member.discipline) &&
        !isCourtDiscipline(member.discipline)
          ? tDirector("disciplineFitness")
          : tDirector("disciplineCourt", { sport }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const coachNamesByPlayer = new Map<string, string[]>();
  for (const row of assignmentRows ?? []) {
    coachNamesByPlayer.set(row.player_id, [
      ...(coachNamesByPlayer.get(row.player_id) ?? []),
      nameOf(row.coach_id),
    ]);
  }

  const players = (playerRows ?? []).map((player) => ({
    id: player.id,
    name: player.name,
    birthYear: player.birth_year,
    coachNames: (coachNamesByPlayer.get(player.id) ?? []).sort().join(", "),
  }));

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-semibold text-foreground">
          {t("title")}
        </h1>
        <Link
          href="/director"
          className="flex-none text-sm font-medium text-muted underline"
        >
          {t("back")}
        </Link>
      </div>
      <p className="text-sm text-muted">{t("intro")}</p>
      <BulkAssignForm players={players} coaches={coaches} />
    </div>
  );
}
