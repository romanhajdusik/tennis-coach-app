import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { ConnectForm } from "./connect-form";

type PlannedData = { date?: string };
type ActualData = { date?: string };

export default async function ParentDashboardPage() {
  const t = await getTranslations("Parent.dashboard");
  const tCommon = await getTranslations("Common");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  const { data: connection } = await supabase
    .from("player_connections")
    .select("id, players(name)")
    .eq("parent_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const connectedPlayerName = (
    connection?.players as { name: string } | null
  )?.name;

  const { data: records } = connection
    ? await supabase
        .from("parent_session_records")
        .select("id, status, planned_data, actual_data")
        .eq("parent_id", user.id)
    : { data: null };

  const sessions = (records ?? [])
    .map((record) => {
      const planned = record.planned_data as PlannedData | null;
      const actual = record.actual_data as ActualData | null;
      return { ...record, date: actual?.date ?? planned?.date };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("title")}
        </h1>
        <form action={logout.bind(null, "/parent/login")}>
          <button
            type="submit"
            className="text-sm font-medium text-muted underline "
          >
            {t("logout")}
          </button>
        </form>
      </div>

      {!connection ? (
        <ConnectForm />
      ) : (
        <>
          <p className="text-sm text-muted ">
            {t("connectedTo", { name: connectedPlayerName ?? "" })}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/parent/calendar"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
            >
              {t("calendar")}
            </Link>
            <Link
              href="/parent/analytics/Forhand"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground "
            >
              {t("analytics")}
            </Link>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted ">
              {t("sessionsHeading")}
            </h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted ">
                {t("noSessions")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/parent/sessions/${session.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 "
                    >
                      <p className="font-medium text-foreground ">
                        {session.date
                          ? format.dateTime(new Date(session.date), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </p>
                      <span className="text-xs font-medium text-muted ">
                        {tCommon(`status.${session.status}`)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
