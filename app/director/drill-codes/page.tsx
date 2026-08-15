import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireDirector } from "@/app/director/guard";
import { getDrillCodeSlots } from "@/lib/actions/drill-codes";
import { disciplineConfig, type DisciplineId } from "@/lib/discipline";
import { DrillCodeForm } from "@/app/drill-codes/drill-code-form";

/**
 * Federačný štandard kódov cvičení — jediné miesto, kde má šéftréner zápis
 * (§5.5). Tréner tie isté kódy na `/drill-codes` iba číta.
 *
 * Nie je to kozmetika: bez jednotných kódov by sa rozpad v riadiacom pulte
 * nedal poskladať a analytika naprieč federáciou by nebola porovnateľná.
 */
export default async function DirectorDrillCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const t = await getTranslations("Director.drillCodes");
  const tDrillCodes = await getTranslations("DrillCodes");
  const tTeam = await getTranslations("Director.team");
  const { supabase, org, userId } = await requireDirector();

  // Šéftréner nastavuje štandard pre OBE disciplíny — kondičný tréner v jeho
  // organizácii kódy potrebuje tiež, ale sám ich meniť nesmie (§5.5). Sám
  // pritom žiadnu disciplínu „nerobí", takže si ju tu vyberá.
  const selected: DisciplineId =
    (await searchParams).discipline === "fitness" ? "fitness" : "tennis";
  const discipline = disciplineConfig(selected);

  const slotsByCategory = await Promise.all(
    discipline.categories.map((category) =>
      getDrillCodeSlots(supabase, userId, category, discipline),
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

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          {t("disciplineHeading")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["tennis", "fitness"] as const).map((id) => (
            <Link
              key={id}
              href={`/director/drill-codes?discipline=${id}`}
              className={
                selected === id
                  ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground"
              }
            >
              {id === "fitness" ? t("disciplineFitness") : t("disciplineTennis")}
            </Link>
          ))}
        </div>
      </div>

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
