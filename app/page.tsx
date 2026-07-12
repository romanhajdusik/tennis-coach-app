import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { DEFAULT_CATEGORY } from "@/lib/drill-options";

export default async function Home() {
  const t = await getTranslations("Home");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h1>
      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-zinc-600 dark:text-zinc-400">
            {t("loggedInAs")} <span className="font-medium">{user.email}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/players"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              {t("players")}
            </Link>
            <Link
              href="/sessions"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              {t("sessions")}
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              {t("calendar")}
            </Link>
            <Link
              href="/drill-codes"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              {t("drillCodes")}
            </Link>
            <Link
              href={`/analytics/${DEFAULT_CATEGORY}`}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              {t("analytics")}
            </Link>
            <Link
              href="/settings"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              {t("settings")}
            </Link>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              {t("logout")}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            {t("login")}
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            {t("register")}
          </Link>
        </div>
      )}
    </div>
  );
}
