import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const registrationEnabled = process.env.REGISTRATION_ENABLED === "true";
  const t = await getTranslations("Auth.register");

  if (!registrationEnabled) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center ">
        <p className="max-w-sm text-sm text-muted ">
          {t("closed")}
        </p>
        <Link
          href="/login"
          className="font-medium text-foreground underline "
        >
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 ">
      <RegisterForm />
    </div>
  );
}
