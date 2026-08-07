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
    .select("id, user_id, role, status, invite_code")
    .eq("organization_id", org.id)
    .in("status", ["invited", "active"])
    .order("created_at", { ascending: true });

  const active = (members ?? []).filter((member) => member.status === "active");
  const pending: PendingInvite[] = (members ?? [])
    .filter((member) => member.status === "invited" && member.invite_code)
    .map((member) => ({ id: member.id, code: member.invite_code as string }));

  const userIds = active
    .map((member) => member.user_id)
    .filter((id): id is string => Boolean(id));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds.length > 0 ? userIds : [org.id]);

  const { data: players } = await supabase
    .from("players")
    .select("coach_id")
    .eq("organization_id", org.id)
    .eq("is_active", true);

  const playerCounts = new Map<string, number>();
  for (const player of players ?? []) {
    playerCounts.set(player.coach_id, (playerCounts.get(player.coach_id) ?? 0) + 1);
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
        seatsUsed={seatsUsed}
        seatLimit={organization?.seat_limit ?? 0}
      />
    </div>
  );
}
