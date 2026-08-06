import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext, type OrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";

/**
 * Vstup do riadiaceho pultu. Pult existuje len na subdoméne organizácie a len
 * pre rolu `director` — tréner aj samostatný účet sa vrátia na svoj domov.
 *
 * Je to smerovanie, nie bezpečnostná hranica: aj keby sa sem niekto dostal,
 * RLS mu cudzie riadky nevydá (§5.7).
 */
export async function requireDirector(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  org: OrgContext;
  userId: string;
}> {
  const org = await getOrgContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!org) {
    redirect("/");
  }
  if ((await getOrgRole(supabase, user.id)) !== "director") {
    redirect("/");
  }

  return { supabase, org, userId: user.id };
}
