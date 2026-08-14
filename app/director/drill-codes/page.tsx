import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { getDrillCodeSlots } from "@/lib/actions/drill-codes";
import { getDisciplineConfig } from "@/lib/discipline";
import { DrillCodeForm } from "@/app/drill-codes/drill-code-form";

/**
 * Federačný štandard kódov cvičení — jediné miesto, kde má šéftréner zápis
 * (§5.5). Tréner tie isté kódy na `/drill-codes` iba číta.
 *
 * Nie je to kozmetika: bez jednotných kódov by sa rozpad v riadiacom pulte
 * nedal poskladať a analytika naprieč federáciou by nebola porovnateľná.
 */
export default async function DirectorDrillCodesPage() {
  const discipline = getDisciplineConfig();
  const t = await getTranslations("Director.drillCodes");
  const tDrillCodes = await getTranslations("DrillCodes");
  const tTeam = await getTranslations("Director.team");
  const { supabase, org, userId } = await requireDirector();

  const slotsByCategory = await Promise.all(
    discipline.categories.map((category) =>
      getDrillCodeSlots(supabase, userId, category),
    ),
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">
            {tDrillCodes("title")}
          </h1>
          <p className="text-sm text-muted">{org.name}</p>
        </div>
        <Link
          href="/director"
          className="flex-none text-sm font-medium text-muted underline"
        >
          {tTeam("back")}
        </Link>
      </div>

      <p className="text-sm text-muted">
        {t("description", { organization: org.name })}
      </p>

      {discipline.categories.map((category, index) => (
        <DrillCodeForm
          key={category}
          category={category}
          initialSlots={slotsByCategory[index]}
          groups={discipline.analytics.groupedCategories[category]}
          owner="organization"
        />
      ))}
    </div>
  );
}
