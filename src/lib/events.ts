import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Journalise une anomalie dans system_events (lu par le cron health-digest). Ne lève jamais. */
export async function logEvent(
  source: string,
  message: string,
  context: Record<string, unknown> = {},
  level: "info" | "warning" | "error" = "error",
): Promise<void> {
  try {
    await createAdminClient().from("system_events").insert({ source, message: message.slice(0, 2000), context, level });
  } catch (err) {
    console.error("[logEvent]", source, message, err);
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
