import { isAuthorizedCron } from "@/lib/cron";
import { json, jsonError } from "@/lib/http";
import { readiness } from "@/lib/readiness";

/** Utilisé par le robot de prospection (mode AUTO) et le bilan quotidien. Protégé par CRON_SECRET. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  return json(await readiness());
}
