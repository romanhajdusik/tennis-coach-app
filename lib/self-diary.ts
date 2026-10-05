import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Je prihlásený účet HRÁČSKY DENNÍK — hráč, ktorý si tréningy zapisuje sám
 * (docs/roadmap-buduce-smery.md §6)?
 *
 * Technicky je to trénerský účet s jedinou kartou, ktorou je hráč sám, takže
 * appka funguje celá. Tento príznak mení len to, čo hráčovi nedáva zmysel:
 * texty o „hráčoch" a pridávanie či archiváciu ďalších kariet.
 *
 * Príznak nastavuje len registrácia (`handle_new_user`) a účet si ho nezmení
 * sám — `authenticated` nemá na `profiles` UPDATE.
 */
export const isSelfDiary = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data } = await supabase
    .from("profiles")
    .select("self_diary")
    .eq("id", user.id)
    .maybeSingle();

  return data?.self_diary === true;
});
