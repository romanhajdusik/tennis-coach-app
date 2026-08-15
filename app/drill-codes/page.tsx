import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getDrillCodeSlots } from "@/lib/actions/drill-codes";
import { getOrgContext } from "@/lib/org/context";
import { getDisciplineConfig } from "@/lib/discipline";
import { DrillCodeForm } from "./drill-code-form";

export default async function DrillCodesPage() {
  const discipline = await getDisciplineConfig();
  const t = await getTranslations("DrillCodes");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // V org režime sú kódy štandardom federácie — tréner ich len používa (§5.5).
  const org = await getOrgContext();

  const slotsByCategory = await Promise.all(
    discipline.categories.map((category) =>
      getDrillCodeSlots(supabase, user.id, category),
    ),
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-muted underline "
        >
          {tCommon("back")}
        </Link>
      </div>
      <p className="text-sm text-muted ">
        {org ? t("orgDescription", { organization: org.name }) : t("description")}
      </p>

      {discipline.categories.map((category, index) => (
        <DrillCodeForm
          key={category}
          category={category}
          initialSlots={slotsByCategory[index]}
          groups={discipline.analytics.groupedCategories[category]}
          readOnly={Boolean(org)}
        />
      ))}
    </div>
  );
}
