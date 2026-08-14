import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { HomeButton } from "@/components/home-button";
import { TimezoneDetector } from "@/components/timezone-detector";
import { TrialBanner } from "@/components/trial-banner";
import { getOrgContext } from "@/lib/org/context";
import { getDiscipline } from "@/lib/discipline";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Common");
  return {
    title: t("appTitle"),
    description: t("appDescription"),
    robots: { index: false, follow: false },
  };
}

/**
 * Ktorá z troch appiek nad tým istým kódom to je — riadi farbu tlačidiel
 * (odtiene a dôvod sú v `globals.css`). Federáciu treba pýtať z org kontextu,
 * nie z disciplíny: je to tá istá tenisová appka, len na org subdoméne.
 */
async function appVariant(): Promise<"org" | "fitness" | undefined> {
  if (await getOrgContext()) return "org";
  return getDiscipline() === "fitness" ? "fitness" : undefined;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      data-app={await appVariant()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {/* Nad obsahom, aby si tréner koniec skúšobnej doby nevšimol až
              vtedy, keď mu zlyhá uloženie. Sám sa skryje, kým je všetko
              v poriadku. */}
          <TrialBanner />
          {children}
          <HomeButton />
          <TimezoneDetector />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
