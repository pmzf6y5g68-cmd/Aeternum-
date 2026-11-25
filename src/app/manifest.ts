import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: siteConfig.tagline,
    lang: "fr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#ffffff",
    theme_color: "#1758e6",
    categories: ["lifestyle", "productivity", "business"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mes rendez-vous", url: "/compte", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Rechercher", url: "/recherche", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Agenda pro", url: "/pro/agenda", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  };
}
