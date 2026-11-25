import { businessEntries, categoryCityEntries, staticEntries, urlset } from "@/lib/sitemap";

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ part: string }> }) {
  const part = (await params).part.replace(/\.xml$/, "");
  let entries;
  if (part === "static") entries = staticEntries();
  else if (part === "villes") entries = await categoryCityEntries().catch(() => []);
  else if (/^etablissements-\d{1,4}$/.test(part)) entries = await businessEntries(Number(part.split("-")[1])).catch(() => []);
  else return new Response("Not found", { status: 404 });
  return new Response(urlset(entries), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
