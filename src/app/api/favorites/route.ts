import { z } from "zod";
import { json, jsonError } from "@/lib/http";
import { createSessionClient } from "@/lib/supabase/server";

/** Bascule un favori pour l'usager connecté (RLS : user_id = auth.uid()). */
export async function POST(request: Request) {
  const parsed = z.object({ business_id: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request");
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError("unauthorized", 401);

  const existing = await supabase.from("favorites").select("business_id").eq("business_id", parsed.data.business_id).maybeSingle();
  if (existing.data) {
    await supabase.from("favorites").delete().eq("business_id", parsed.data.business_id).eq("user_id", auth.user.id);
    return json({ favorite: false });
  }
  const { error } = await supabase.from("favorites").insert({ user_id: auth.user.id, business_id: parsed.data.business_id });
  if (error) return jsonError("db_error", 500);
  return json({ favorite: true });
}
