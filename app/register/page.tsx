import { RegisterForm } from "./register-form";

/**
 * Registrácia. Od 2026-08-16 sa nezatvára úplne — beží buď verejne
 * (`REGISTRATION_ENABLED=true`), alebo **na pozvánku**, teda len s promo
 * kódom. Predtým tu bola len hláška „registrácia je zatvorená" a účty sa
 * zakladali ručne, čím sa k appke nedostal ani tester.
 *
 * Kód platí pre obe nasadenia rovnako (tenis aj kondička) — je to vlastnosť
 * účtu, nie disciplíny.
 */
export default function RegisterPage() {
  const promoRequired = process.env.REGISTRATION_ENABLED !== "true";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 ">
      <RegisterForm promoRequired={promoRequired} />
    </div>
  );
}
