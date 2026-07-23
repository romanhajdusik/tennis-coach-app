import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Umožňuje testovanie z mobilu v lokálnej WiFi sieti (Mobile First vývoj) —
  // Next.js dev server inak blokuje cross-origin prístup z iného zariadenia.
  allowedDevOrigins: ["10.241.70.191"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Zabraňuje clickjackingu (appka sa nedá vložiť do cudzieho <iframe>) —
          // Next.js server actions síce majú vstavanú ochranu proti CSRF cez
          // kontrolu Origin hlavičky, ale clickjacking to neriešil, keďže
          // požiadavka pri ňom vzniká na appke samotnej (v skrytom iframe).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
