// Landing page má vlastnú, samostatnú jazykovú vrstvu (SK/EN/DE/ES/RU/FR/ZH/IT/JA),
// oddelenú od appky (i18n/request.ts, len SK/EN). Appka ako celok sa
// neprekladá do týchto ďalších jazykov — len táto verejná marketingová
// stránka a návody, preto vlastný cookie a vlastný loader mimo next-intl.
// Poradie v prepínači jazykov (landing + návody). EN je prvé a je to
// predvolený jazyk (defaultLandingLocale nižšie). SK je zámerne posledné.
export const LANDING_LOCALES = [
  "en",
  "de",
  "es",
  "ru",
  "fr",
  "zh",
  "it",
  "ja",
  "sk",
] as const;
export type LandingLocale = (typeof LANDING_LOCALES)[number];
export const defaultLandingLocale: LandingLocale = "en";

export function isValidLandingLocale(
  value: string | undefined,
): value is LandingLocale {
  return !!value && (LANDING_LOCALES as readonly string[]).includes(value);
}

export async function loadLandingMessages(locale: LandingLocale) {
  const messages = await import(`../messages/${locale}/landing.json`);
  return messages.default as {
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    guideLink: string;
    guideCoach: string;
    guidePlayer: string;
    showcaseTitle: string;
    showcaseSubtitle: string;
    showcaseCaptions: { calendar: string; session: string; analytics: string };
    featuresTitle: string;
    features: { title: string; description: string }[];
    pricingTitle: string;
    pricingBadge: string;
    pricingText: string;
    pricingCta: string;
    finalCtaTitle: string;
    finalCtaSubtitle: string;
    finalCtaButton: string;
    footerTagline: string;
  };
}

// Návod (stránka /navod) používa tú istú jazykovú vrstvu ako landing page
// (LANDING_LOCALE, 9 jazykov), nie appkové next-intl SK/EN — je to verejná
// časť webu plaw.online popri landingu.
export type NavodMessages = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  backToHome: string;
  stepWord: string;
  steps: { title: string; body: string }[];
  tipsTitle: string;
  tips: string[];
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
  crossLinkText: string;
  crossLinkCta: string;
};

export async function loadNavodMessages(
  locale: LandingLocale,
): Promise<NavodMessages> {
  const messages = await import(`../messages/${locale}/navod.json`);
  return messages.default as NavodMessages;
}

// Krátky návod pre pripojeného hráča/rodiča/manažéra (/navod-hrac) — rovnaká
// štruktúra aj jazyková vrstva ako trénerský návod.
export async function loadNavodHracMessages(
  locale: LandingLocale,
): Promise<NavodMessages> {
  const messages = await import(`../messages/${locale}/navod-hrac.json`);
  return messages.default as NavodMessages;
}
