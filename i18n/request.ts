import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["sk", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "sk";

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
  };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = (locales as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as AppLocale)
    : defaultLocale;

  const cookieTimeZone = cookieStore.get("NEXT_TIMEZONE")?.value;
  const timeZone = isValidTimeZone(cookieTimeZone) ? cookieTimeZone : defaultTimeZone;

  return {
    locale,
    timeZone,
    messages: await loadMessages(locale),
  };
});
