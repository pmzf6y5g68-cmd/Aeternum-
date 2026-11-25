import "server-only";
import { absoluteUrl } from "@/lib/seo";
import { businessPath } from "@/lib/slug";

/**
 * Signale instantanément les pages créées ou modifiées aux moteurs IndexNow (Bing — qui alimente Copilot et
 * une partie des recherches des assistants IA —, Yandex, Seznam, Naver). Best effort, jamais bloquant.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  const host = (process.env.APP_DOMAIN ?? "").replace(/^https?:\/\//, "");
  if (!key || !host || paths.length === 0) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation: absoluteUrl("/indexnow.txt"), urlList: Array.from(new Set(paths)).map(absoluteUrl) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Les sitemaps restent la source de vérité si le ping échoue.
  }
}

export function businessUrlsToPing(b: { slug: string; category: string; city_slug: string | null }): string[] {
  return [businessPath(b), `/${b.category}`, ...(b.city_slug ? [`/${b.category}/${b.city_slug}`] : [])];
}
