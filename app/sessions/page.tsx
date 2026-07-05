import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSessionForm } from "./new-session-form";

type PlannedData = {
  date?: string;
  focus?: string;
  duration_minutes?: number;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Naplánovaný",
  completed: "Dokončený",
  cancelled: "Zrušený",
};

export default async function SessionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: activePlayer } = await supabase
    .from("players")
    .select("id, name")
    .eq("coach_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const { data: sessions } = activePlayer
    ? await supabase
        .from("sessions")
        .select("id, status, planned_data")
        .eq("player_id", activePlayer.id)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Tréningy
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Späť
        </Link>
      </div>

      {!activePlayer ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Najprv{" "}
          <Link href="/players" className="underline">
            nastav aktívneho hráča
          </Link>
          , potom mu budeš môcť naplánovať tréning.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aktívny hráč: <span className="font-medium">{activePlayer.name}</span>
          </p>

          <NewSessionForm />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Plán
            </h2>
            {!sessions || sessions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Zatiaľ žiadne naplánované tréningy.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => {
                  const planned = session.planned_data as PlannedData | null;
                  return (
                    <li
                      key={session.id}
                      className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {planned?.date
                            ? new Date(planned.date).toLocaleString("sk-SK", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "Bez dátumu"}
                        </p>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {STATUS_LABELS[session.status] ?? session.status}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {planned?.focus}
                        {planned?.duration_minutes
                          ? ` · ${planned.duration_minutes} min`
                          : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
