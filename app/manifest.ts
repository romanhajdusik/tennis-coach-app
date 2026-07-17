import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("Common");

  return {
    name: t("appTitle"),
    short_name: t("appShortName"),
    description: t("appDescription"),
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
