import { type NextRequest } from "next/server";
import { matchCategories } from "@/config/categories";
import { json } from "@/lib/http";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SearchRow } from "@/lib/supabase/types";

/** Autocomplétion « Quoi » : métiers (local, instantané) + établissements (FTS + trigrammes). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return json({ categories: [], businesses: [] });

  const categories = matchCategories(q, 4).map((c) => ({ slug: c.slug, label: c.label, icon: c.icon }));
  const { data } = await createAdminClient().rpc("search_businesses", { p_query: q, p_limit: 5 });
  const businesses = ((data ?? []) as SearchRow[]).map((b) => ({ name: b.name, path: businessPath(b), city: b.city, category: b.category }));
  return json({ categories, businesses });
}
