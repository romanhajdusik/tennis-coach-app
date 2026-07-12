import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const registrationEnabled = process.env.REGISTRATION_ENABLED === "true";
  const t = await getTranslations("Auth.register");

  if (!registrationEnabled) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center dark:bg-black">
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {t("closed")}
        </p>
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <RegisterForm />
    </div>
  );
}
