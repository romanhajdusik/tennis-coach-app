import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";
import { JoinForm } from "./join-form";

/**
 * Vstup pozvaného trénera do organizácie. Žije len na org subdoméne a je
 * jedinou cestou dnu — `proxy.ts` sem pošle prihlásený účet bez členstva
 * (bez tejto výnimky by ho stráž vyhodila a kód by nemal kde zadať).
 *
 * Kto už členom je, tu nemá čo robiť — ide rovno do appky.
 */
export default async function JoinPage() {
  const t = await getTranslations("Join");
  const org = await getOrgContext();

  if (!org) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (await getOrgRole(supabase, user.id)) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t("title", { organization: org.name })}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("description")}</p>
      </div>

      <JoinForm />

      <form action={logout.bind(null, "/login")}>
        <button
          type="submit"
          className="text-sm font-medium text-muted underline"
        >
          {t("logout")}
        </button>
      </form>
    </div>
  );
}
