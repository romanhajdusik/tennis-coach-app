import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Umožňuje testovanie z mobilu v lokálnej WiFi sieti (Mobile First vývoj) —
  // Next.js dev server inak blokuje cross-origin prístup z iného zariadenia.
  allowedDevOrigins: ["10.113.97.191"],
};

export default withNextIntl(nextConfig);
