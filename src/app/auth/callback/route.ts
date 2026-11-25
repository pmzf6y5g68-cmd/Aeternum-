import { NextResponse, type NextRequest } from "next/server";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/compte";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/compte";

  if (code) {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Email vérifié par le lien magique : on rattache les RDV pris en invité avec cet email.
      if (data.user?.email) {
        try {
          await createAdminClient().rpc("claim_guest_bookings", { p_user_id: data.user.id, p_email: data.user.email });
        } catch (err) {
          await logEvent("auth.claim", errorMessage(err), { user_id: data.user.id }, "warning");
        }
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=auth", url.origin));
}
