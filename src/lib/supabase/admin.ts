import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Client service_role : contourne la RLS. Réservé aux routes serveur, webhooks et crons. */
export function createAdminClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
