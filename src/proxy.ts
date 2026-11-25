import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rafraîchit la session Supabase ; les layouts protégés (/compte, /pro/*) gèrent eux-mêmes les redirections. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  // Double authentification : une session « email seul » n'accède pas aux espaces privés si un second facteur est activé.
  const path = request.nextUrl.pathname;
  const isPrivate = path.startsWith("/compte") || path.startsWith("/pro/") || path.startsWith("/api/pro") || path.startsWith("/api/stripe");
  if (data.user && isPrivate) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "mfa_required" }, { status: 401 });
      const target = new URL("/auth/mfa", request.url);
      target.searchParams.set("next", `${path}${request.nextUrl.search}`);
      return NextResponse.redirect(target);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|embed.js|widget|manifest.webmanifest|icons|offline|robots.txt|sitemap.xml|sitemaps|llms.txt|indexnow.txt|opengraph-image|api/webhooks|api/unsubscribe|paiement|api/cron|api/suggest|api/slots|api/assistant|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
