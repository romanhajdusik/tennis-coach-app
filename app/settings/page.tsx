import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { disconnectGoogleCalendar } from "@/lib/actions/google-calendar";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const t = await getTranslations("Settings");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { connected, error } = await searchParams;

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("created_at")
    .eq("coach_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
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

      {connected === "1" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-green-950 text-green-400">
          {t("connectedBanner")}
        </p>
      )}
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {t("errorBanner")}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 ">
        <h2 className="text-sm font-medium text-foreground ">
          {t("googleCalendarHeading")}
        </h2>
        {connection ? (
          <>
            <p className="text-sm text-muted ">
              {t("connectedDescription")}
            </p>
            <form action={disconnectGoogleCalendar}>
              <button
                type="submit"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground "
              >
                {t("disconnect")}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted ">
              {t("notConnectedDescription")}
            </p>
            <Link
              href="/api/google/auth"
              className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground "
            >
              {t("connect")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
