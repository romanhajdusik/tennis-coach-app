import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddDrillForm } from "./add-drill-form";

type PlannedData = { date?: string };

const CHARACTER_LABELS: Record<string, string> = {
  offensive: "Offensive",
  neutral: "Neutral",
  defensive: "Defensive",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, planned_data")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    notFound();
  }

  const { data: drills } = await supabase
    .from("session_drills")
    .select("id, category, character, drill_code, duration_minutes")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const planned = session.planned_data as PlannedData | null;
  const totalMinutes = (drills ?? []).reduce(
    (sum, drill) => sum + drill.duration_minutes,
    0,
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Tréning
        </h1>
        <Link
          href="/sessions"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Späť
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          {planned?.date
            ? new Date(planned.date).toLocaleString("sk-SK", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "Bez dátumu"}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Celkové trvanie: {totalMinutes} min
        </p>
      </div>

      <AddDrillForm sessionId={session.id} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Cvičenia
        </h2>
        {!drills || drills.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Zatiaľ žiadne cvičenia.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {drills.map((drill) => (
              <li
                key={drill.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {drill.category} · {drill.drill_code}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {CHARACTER_LABELS[drill.character] ?? drill.character}
                  </p>
                </div>
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {drill.duration_minutes} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
