import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDrillCodeSlots } from "@/lib/actions/drill-codes";
import { ANALYTICS_GROUPED_CATEGORIES, CATEGORY_OPTIONS } from "@/lib/drill-options";
import { DrillCodeForm } from "./drill-code-form";

export default async function DrillCodesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const slotsByCategory = await Promise.all(
    CATEGORY_OPTIONS.map((category) =>
      getDrillCodeSlots(supabase, user.id, category),
    ),
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Kódy cvičení
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Späť
        </Link>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Pre každé zameranie máš 20 slotov na vlastné kódy cvičení. Prázdny
        slot sa v tréningu nepoužije.
      </p>

      {CATEGORY_OPTIONS.map((category, index) => (
        <DrillCodeForm
          key={category}
          category={category}
          initialSlots={slotsByCategory[index]}
          groups={ANALYTICS_GROUPED_CATEGORIES[category]}
        />
      ))}
    </div>
  );
}
