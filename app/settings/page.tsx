import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { disconnectGoogleCalendar } from "@/lib/actions/google-calendar";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Nastavenia
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
        >
          Späť
        </Link>
      </div>

      {connected === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
          Google Kalendár bol úspešne pripojený.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          Pripojenie Google Kalendára sa nepodarilo. Skús to prosím znova.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Google Kalendár
        </h2>
        {connection ? (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Pripojené — naplánované tréningy sa automaticky pridávajú do
              tvojho Google Kalendára.
            </p>
            <form action={disconnectGoogleCalendar}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                Odpojiť
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nepripojené — tréningy sa plánujú len v appke, bez synchronizácie
              s kalendárom.
            </p>
            <Link
              href="/api/google/auth"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Pripojiť Google Kalendár
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
