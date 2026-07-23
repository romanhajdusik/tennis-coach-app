// Landing page má vlastnú, samostatnú jazykovú vrstvu (SK/EN/DE/ES/RU/FR),
// oddelenú od appky (i18n/request.ts, len SK/EN). Appka ako celok sa
// neprekladá do nemčiny/španielčiny/ruštiny/francúzštiny — len táto verejná
// marketingová stránka, preto vlastný cookie a vlastný loader mimo next-intl.
export const LANDING_LOCALES = ["sk", "en", "de", "es", "ru", "fr"] as const;
export type LandingLocale = (typeof LANDING_LOCALES)[number];
export const defaultLandingLocale: LandingLocale = "sk";

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
