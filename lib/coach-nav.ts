import { createClient } from "@/lib/supabase/server";
import { getDisciplineConfig } from "@/lib/discipline";
import { getOrgMembership } from "@/lib/org/membership";

/**
 * Má prihlásený účet dostať spodnú lištu trénerovej appky? `null` = nie.
 *
 * Lištu má len **tréner** — samostatný aj federačný. Rodič, manažér a hráč majú
 * vlastnú časť appky (`/parent`) a šéftréner svoj pult (`/director`); obom
 * ostáva plávajúce tlačidlo „Home". Šéftréner sa registruje ako tréner
 * (`profiles.role = 'coach'`), preto sa rozhoduje aj podľa členstva.
 *
 * Odkaz na analytiku nesie zameranie, na ktorom sa otvára, a to je vec
 * disciplíny — vo federácii ju appka pozná až z členstva, takže sa musí
 * poskladať na serveri, nie v komponente lišty.
 */
export async function getCoachNav(): Promise<{ analyticsHref: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "coach") {
    return null;
  }

  if ((await getOrgMembership())?.role === "director") {
    return null;
  }

  const { defaultCategory } = await getDisciplineConfig();
  return { analyticsHref: `/analytics/${encodeURIComponent(defaultCategory)}` };
}
