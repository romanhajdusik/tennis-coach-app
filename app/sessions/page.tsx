import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSelectedPlayer } from "@/lib/players/selected";
import { PlayerSwitcher } from "@/components/player-switcher";
import { NewSessionForm } from "./new-session-form";

type PlannedData = {
  date?: string;
};

export default async function SessionsPage() {
  const t = await getTranslations("Sessions");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activePlayer = await getSelectedPlayer(supabase, user.id);

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

      <PlayerSwitcher />

      {!activePlayer ? (
        <p className="text-sm text-muted ">
          {t.rich("noActivePlayer", {
            link: (chunks) => (
              <Link href="/players" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted ">
            {t("activePlayer", { name: activePlayer.name })}
          </p>

          <NewSessionForm />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted ">
              {t("planHeading")}
            </h2>
            {!sessions || sessions.length === 0 ? (
              <p className="text-sm text-muted ">
                {t("noSessions")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => {
                  const planned = session.planned_data as PlannedData | null;
                  return (
                    <li key={session.id}>
                      <Link
                        href={`/sessions/${session.id}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 "
                      >
                        <p className="font-medium text-foreground ">
                          {planned?.date
                            ? format.dateTime(new Date(planned.date), {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : t("noDate")}
                        </p>
                        <span className="text-xs font-medium text-muted ">
                          {tCommon(`status.${session.status}`)}
                        </span>
                      </Link>
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
