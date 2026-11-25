import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/** Robots des moteurs de recherche et des assistants IA explicitement accueillis (citations dans les réponses). */
const AI_AND_SEARCH_BOTS = [
  "Googlebot", "Google-Extended", "Bingbot", "Applebot", "Applebot-Extended", "DuckDuckBot", "YandexBot", "Qwantbot",
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User",
  "Meta-ExternalAgent", "MistralAI-User", "CCBot", "Amazonbot", "cohere-ai",
];

const PRIVATE = ["/api/", "/compte", "/pro/agenda", "/pro/prestations", "/pro/equipe", "/pro/horaires", "/pro/ma-page", "/pro/partager", "/pro/avis", "/pro/abonnement", "/paiement/", "/confirm/", "/cancel/", "/avis/", "/desinscription", "/login", "/auth/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
      { userAgent: "*", allow: "/", disallow: PRIVATE },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
