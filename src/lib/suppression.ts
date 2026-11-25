import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SuppressionReason = "unsubscribe" | "bounce" | "complaint" | "manual";

/** Plus aucun email de prospection vers cette adresse ; prospect et fils passent en « stopped ». */
export async function suppressEmail(email: string, reason: SuppressionReason): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const admin = createAdminClient();
  await Promise.all([
    admin.from("email_suppressions").upsert({ email: normalized, reason }, { onConflict: "email", ignoreDuplicates: true }),
    admin.from("prospects").update({ status: "stopped", next_followup_at: null }).eq("email", normalized).neq("status", "converted"),
    admin.from("email_threads").update({ status: "stopped" }).eq("contact_email", normalized).is("business_id", null),
  ]);
}
