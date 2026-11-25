import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Client lié à la session de l'utilisateur connecté (RLS appliquée). */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appel depuis un Server Component : le rafraîchissement est géré par src/proxy.ts.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
