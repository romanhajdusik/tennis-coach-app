import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["sk", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "sk";

async function loadMessages(locale: AppLocale) {
  const [common, auth, home, players] = await Promise.all([
    import(`../messages/${locale}/common.json`),
    import(`../messages/${locale}/auth.json`),
    import(`../messages/${locale}/home.json`),
    import(`../messages/${locale}/players.json`),
  ]);

  return {
    Common: common.default,
    Auth: auth.default,
    Home: home.default,
    Players: players.default,
  };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = (locales as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as AppLocale)
    : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
