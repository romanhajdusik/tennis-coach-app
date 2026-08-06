import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Rola účtu v jeho organizácii. `null` = samostatný tréner (bez členstva). */
export type OrgRole = "director" | "coach";

/**
 * Rola prihláseného v organizácii. Účet má najviac jedno aktívne členstvo
 * (index `one_active_membership_per_user`, §5.8), takže stačí jeden riadok.
 *
 * Číta sa cez RLS policy `organization_members_select_own` — vlastné členstvo
 * si prečíta každý. Je to rozhodnutie o SMEROVANÍ (kam účet patrí v UI),
 * hranicou dát ostáva RLS na dátových tabuľkách.
 */
export async function getOrgRole(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<OrgRole | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return (data?.role as OrgRole | undefined) ?? null;
}
