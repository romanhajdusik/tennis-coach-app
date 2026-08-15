import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Rola účtu v jeho organizácii. `null` = samostatný tréner (bez členstva). */
export type OrgRole = "director" | "coach";

/** Disciplína člena — určuje, čo tréner vo federácii zapisuje (docs §2.2). */
export type OrgDiscipline = "tennis" | "fitness";

export type OrgMembership = {
  organizationId: string;
  role: OrgRole;
  discipline: OrgDiscipline;
};

/**
 * Aktívne členstvo prihláseného účtu — **jediný zdroj pravdy o tom, či appka
 * pracuje vo federačnom režime, a v ktorej disciplíne.**
 *
 * PREČO NIE `getOrgContext()`: ten hovorí, na ktorej SUBDOMÉNE sme, a je
 * správny na smerovanie, branding a tenant izoláciu. Na rozhodovanie o DÁTACH
 * sa ale použiť nedá — RLS sa pýta na členstvo (`current_org_id()`), nie na
 * hostname, a hlavičky `x-plaw-org-*` od proxy v niektorých rendroch nie sú
 * k dispozícii (napr. pri rendri, ktorý nasleduje po `redirect()` zo server
 * action). Appka by vtedy ticho spadla do osobnej vetvy a trénerovi by
 * zmizli všetci hráči — presne to sa aj stalo a chytila to `browser-coach.js` §3.
 *
 * `cache()` = jeden dotaz na požiadavku, aj keď sa naň pýta viac miest.
 */
export const getOrgMembership = cache(async (): Promise<OrgMembership | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // `user_id` filter je nutný: šéftrénerovi policy
  // `organization_members_select_director` vydá všetkých členov organizácie.
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, role, discipline")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    organizationId: data.organization_id,
    role: data.role as OrgRole,
    discipline: data.discipline === "fitness" ? "fitness" : "tennis",
  };
});

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
