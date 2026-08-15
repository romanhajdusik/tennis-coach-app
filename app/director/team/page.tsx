import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import {
  InviteSection,
  type ActiveMember,
  type PendingInvite,
} from "./invite-section";

/**
 * Onboarding trénerov do organizácie (§5.9, krok „šéftréner pozýva kódom").
 *
 * Sedadlá: proti `seat_limit` sa počítajú len tréneri — šéftréner miesto
 * neberie (rovnako to počíta aj trigger `enforce_membership_rules`, tu je to
 * len zobrazenie).
 */
export default async function DirectorTeamPage() {
  const t = await getTranslations("Director.team");
  const { supabase, org } = await requireDirector();

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status, discipline, invite_code")
    .eq("organization_id", org.id)
    .in("status", ["invited", "active", "removed"])
    .order("created_at", { ascending: true });

  const active = (members ?? []).filter((member) => member.status === "active");
  const pending: PendingInvite[] = (members ?? [])
    .filter((member) => member.status === "invited" && member.invite_code)
    .map((member) => ({
      id: member.id,
      code: member.invite_code as string,
      discipline: member.discipline,
    }));

  // Odobratý tréner zo zoznamu nezmizne — šéftréner ho môže vrátiť späť alebo
  // vymazať natrvalo. Zrušené pozvánky (nikdy neprijaté, teda bez `user_id`)
  // sem nepatria: nebol za nimi človek a boli by to len prázdne riadky.
  const removed = (members ?? []).filter(
    (member) => member.status === "removed" && member.user_id,
  );

  const userIds = [...active, ...removed]
    .map((member) => member.user_id)
    .filter((id): id is string => Boolean(id));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds.length > 0 ? userIds : [org.id]);

  // Počet hráčov sa berie z PRIRADENÍ, nie z `players.coach_id` — ten je v org
  // režime len autor riadku a kondičnému trénerovi by ukázal nulu, hoci hráčov má.
  const { data: assignments } = await supabase
    .from("player_assignments")
    .select("coach_id, players!inner(is_active)")
    .eq("organization_id", org.id)
    .eq("players.is_active", true);

  const playerCounts = new Map<string, number>();
  for (const assignment of assignments ?? []) {
    playerCounts.set(
      assignment.coach_id,
      (playerCounts.get(assignment.coach_id) ?? 0) + 1,
    );
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const list: ActiveMember[] = active.map((member) => {
    const profile = member.user_id ? profileById.get(member.user_id) : undefined;
    return {
      id: member.id,
      name: profile?.full_name?.trim() || profile?.email || "—",
      role: member.role,
      discipline: member.discipline,
      playerCount: member.user_id
        ? (playerCounts.get(member.user_id) ?? 0)
        : 0,
    };
  });

  // Neaktívny tréner sedadlo nedrží, takže sa počíta len z aktívnych. Preto sa
  // pri ňom zobrazuje aj počet hráčov — šéftréner vidí, koho ešte má na krku,
  // kým ho vráti späť alebo hráčov niekomu pridelí.
  const inactive: ActiveMember[] = removed.map((member) => {
    const profile = member.user_id ? profileById.get(member.user_id) : undefined;
    return {
      id: member.id,
      name: profile?.full_name?.trim() || profile?.email || "—",
      role: member.role,
      discipline: member.discipline,
      playerCount: member.user_id
        ? (playerCounts.get(member.user_id) ?? 0)
        : 0,
    };
  });

  // Sedadlá držia len tréneri; šéftréner miesto neberie.
  const seatsUsed = active.filter((member) => member.role === "coach").length;

  const { data: organization } = await supabase
    .from("organizations")
    .select("seat_limit")
    .eq("id", org.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted">{org.name}</p>
        </div>
        <Link
          href="/director"
          className="flex-none text-sm font-medium text-muted underline"
        >
          {t("back")}
        </Link>
      </div>

      <InviteSection
        pending={pending}
        members={list}
        inactive={inactive}
        seatsUsed={seatsUsed}
        seatLimit={organization?.seat_limit ?? 0}
      />
    </div>
  );
}
