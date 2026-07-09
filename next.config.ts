import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Umožňuje testovanie z mobilu v lokálnej WiFi sieti (Mobile First vývoj) —
  // Next.js dev server inak blokuje cross-origin prístup z iného zariadenia.
  allowedDevOrigins: ["10.113.97.191"],
};

export default nextConfig;
