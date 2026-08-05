import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Appka samotná je výhradne anglická. Slovenčina zostáva len na verejnom
// webe (landing + návody, vlastná vrstva v lib/landing-locale.ts) a v kóde,
// commitoch a dokumentácii — nie v UI produktu. Preto tu už nie je žiadny
// prepínač jazyka ani SK locale.
export const locales = ["en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

// Appka sa používa medzinárodne — každý používateľ má vidieť čas vo
// vlastnom časovom pásme (zisťuje sa v prehliadači, pozri
// components/timezone-detector.tsx), nie natvrdo slovenský. Kým sa
// nezistí (prvé zobrazenie pred spustením JS), použije sa tento default.
export const defaultTimeZone = "Europe/Bratislava";

const validTimeZones = new Set(Intl.supportedValuesOf("timeZone"));

export function isValidTimeZone(value: string | undefined): value is string {
  return !!value && validTimeZones.has(value);
}

async function loadMessages(locale: AppLocale) {
  const [
    common,
    auth,
    home,
    players,
    sessions,
    drillCodes,
    analytics,
    calendar,
    settings,
    parent,
    today,
  ] = await Promise.all([
    import(`../messages/${locale}/common.json`),
    import(`../messages/${locale}/auth.json`),
    import(`../messages/${locale}/home.json`),
    import(`../messages/${locale}/players.json`),
    import(`../messages/${locale}/sessions.json`),
    import(`../messages/${locale}/drill-codes.json`),
    import(`../messages/${locale}/analytics.json`),
    import(`../messages/${locale}/calendar.json`),
    import(`../messages/${locale}/settings.json`),
    import(`../messages/${locale}/parent.json`),
    import(`../messages/${locale}/today.json`),
  ]);

  return {
    Common: common.default,
    Auth: auth.default,
    Home: home.default,
    Players: players.default,
    Sessions: sessions.default,
    DrillCodes: drillCodes.default,
    Analytics: analytics.default,
    Calendar: calendar.default,
    Settings: settings.default,
    Parent: parent.default,
    Today: today.default,
  };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();

  // Jazyk appky je vždy angličtina (žiadna cookie NEXT_LOCALE sa už nečíta).
  const locale: AppLocale = defaultLocale;

  const cookieTimeZone = cookieStore.get("NEXT_TIMEZONE")?.value;
  const timeZone = isValidTimeZone(cookieTimeZone) ? cookieTimeZone : defaultTimeZone;

  return {
    locale,
    timeZone,
    messages: await loadMessages(locale),
  };
});
