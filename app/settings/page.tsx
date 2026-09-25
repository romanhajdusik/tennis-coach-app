import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgMembership } from "@/lib/org/membership";

// Nastavenia účtu. Stránka zanikla 2026-08-29 spolu s Google Kalendárom (bol
// jej jediný obsah) a vracia sa preto, že prihlásený sa inak k podmienkam
// a zásadám v appke nedostane — odkazy na ne sú dnes len na verejnom webe
// a pri registrácii, teda pred prihlásením.
//
// Export dát a zmazanie účtu sú tu zatiaľ ako kontakt, nie ako tlačidlo:
// zmazanie účtu vyžaduje `service_role` kľúč, ktorý appka nikde nedrží a ktorý
// príde až so Stripe webhookom (CLAUDE.md, Fáza 3). Zákonná lehota je mesiac,
// takže ručné vybavenie ju spĺňa.
export const metadata: Metadata = {
  title: "Settings — P.L.A.W",
};

/** Adresa podpory pre existujúceho zákazníka — `info@` je kontakt verejného webu. */
const SUPPORT_EMAIL = "support@plawsports.com";

export default async function SettingsPage() {
  const t = await getTranslations("Settings");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Šéftréner sa registruje ako tréner (`profiles.role = 'coach'`), takže sa
  // rozoznáva až podľa členstva — rovnako ako v `lib/coach-nav.ts`.
  const membership = await getOrgMembership();
  const isDirector = membership?.role === "director";
  const role = profile?.role ?? "coach";
  const isFollower = role === "parent" || role === "manager" || role === "player";

  // Každé publikum má vlastné znenie: tréner (samostatný aj federačný — jeho
  // prípad rieši §3 podmienok) trénerské, sledujúci spotrebiteľské, šéftréner
  // zásady pre organizácie. Cesty sú relatívne, lebo znenie pre sledujúceho
  // býva na plaw.click a proxy tam odkaz presmeruje (`CANONICAL_ORIGINS`) —
  // rovnako ako pri registrácii.
  const documents = isDirector
    ? [{ href: "/zasady-organizacia", label: t("privacy") }]
    : isFollower
      ? [
          { href: "/podmienky-hrac", label: t("terms") },
          { href: "/zasady-hrac", label: t("privacy") },
        ]
      : [
          { href: "/podmienky", label: t("terms") },
          { href: "/zasady", label: t("privacy") },
        ];

  // Každá časť appky má vlastný domov, rovnako ako v `components/home-button.tsx`.
  const home = isFollower ? "/parent" : isDirector ? "/director" : "/";

  const roleLabel = isDirector
    ? t("roles.director")
    : t(`roles.${role}` as "roles.coach");

  return (
    <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <Link href={home} className="text-sm font-medium text-muted underline">
          {tCommon("back")}
        </Link>
      </div>

      <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("accountHeading")}
        </h2>
        <p className="text-sm text-muted">
          {t("signedInAs")}{" "}
          <span className="font-medium text-foreground">{user.email}</span>
        </p>
        <p className="text-sm text-muted">{roleLabel}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("documentsHeading")}
        </h2>
        <p className="text-sm text-muted">{t("documentsIntro")}</p>
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              {doc.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-foreground">
          {t("dataHeading")}
        </h2>
        <p className="text-sm text-muted">{t("dataText")}</p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-sm font-medium text-primary underline"
        >
          {SUPPORT_EMAIL}
        </a>
        <p className="text-xs text-muted">{t("dataNote")}</p>
      </section>
    </div>
  );
}
