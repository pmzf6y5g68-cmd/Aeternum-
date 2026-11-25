import { type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { suppressEmail } from "@/lib/suppression";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

/** RFC 8058 : POST « List-Unsubscribe=One-Click » envoyé par Gmail / Yahoo / Apple Mail, sans interaction. */
export async function POST(request: NextRequest) {
  const email = verifyUnsubscribe(request.nextUrl.searchParams.get("t"), env.unsubscribeSecret());
  if (!email) return new Response("Invalid token", { status: 400 });
  await suppressEmail(email, "unsubscribe");
  return new Response("OK", { status: 200 });
}
