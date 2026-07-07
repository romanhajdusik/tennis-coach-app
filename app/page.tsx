import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Tenisový tréner
      </h1>
      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-zinc-600 dark:text-zinc-400">
            Prihlásený ako <span className="font-medium">{user.email}</span>
          </p>
          <div className="flex gap-3">
            <Link
              href="/players"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Hráči
            </Link>
            <Link
              href="/sessions"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Tréningy
            </Link>
            <Link
              href="/drill-codes"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Kódy cvičení
            </Link>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Odhlásiť sa
            </button>
          </form>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Prihlásiť sa
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Registrácia
          </Link>
        </div>
      )}
    </div>
  );
}
