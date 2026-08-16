import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Nastavenie nového hesla. Sem sa človek dostane až cez `/auth/confirm`, ktorý
 * odkaz z mailu vymenil za session — preto sa tu formulár ukáže len vtedy, keď
 * session naozaj existuje.
 *
 * Prihlásený človek si sem môže prísť zmeniť heslo aj sám, bez mailu; je to tá
 * istá obrazovka a tá istá akcia, takže sa tým nič nekomplikuje.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("Auth.resetPassword");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await searchParams;

  // Vypršaný, už použitý alebo v inom prehliadači otvorený odkaz — človek
  // nesmie skončiť pri prázdnej stránke bez vysvetlenia.
  if (!user || error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 ">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm ">
          <h1 className="text-xl font-semibold text-foreground ">
            {t("expiredHeading")}
          </h1>
          <p className="mt-2 text-sm text-muted ">{t("expired")}</p>
          <Link
            href="/forgot-password"
            className="mt-6 block rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground "
          >
            {t("requestNew")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 ">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm ">
        <h1 className="text-xl font-semibold text-foreground ">
          {t("heading")}
        </h1>
        <p className="mt-1 text-sm text-muted ">{user.email}</p>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
