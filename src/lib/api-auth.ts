import "server-only";
import { createSessionClient } from "@/lib/supabase/server";
import type { Studio } from "@/lib/supabase/types";

/** Studio de l'utilisateur connecté pour les routes API du dashboard. */
export async function getApiStudio(): Promise<Studio | null> {
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("studios").select("*").eq("owner_id", auth.user.id).maybeSingle<Studio>();
  return data;
}
