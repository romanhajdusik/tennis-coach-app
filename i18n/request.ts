import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["sk", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "sk";

async function loadMessages(locale: AppLocale) {
  const [common] = await Promise.all([import(`../messages/${locale}/common.json`)]);

  return {
    Common: common.default,
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
