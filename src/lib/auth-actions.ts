"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "@/lib/auth-providers";

export interface MagicLinkState {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
}

export interface CodeState {
  status: "idle" | "error";
  message?: string;
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/compte";
}

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { status: "error", message: "invalid_email" };

  const next = safeNext(formData.get("next"));
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${env.appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { status: "error", message: /rate|seconds/i.test(error.message) ? "rate_limited" : "server" };
  return { status: "sent", email: email.data };
}

/** Code à 6 chiffres reçu par email (alternative au lien, pratique depuis l'application installée). */
export async function verifyEmailCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!email.success || !/^\d{6,8}$/.test(token)) return { status: "error", message: "invalid_code" };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token, type: "email" });
  if (error || !data.user) return { status: "error", message: "invalid_code" };
  try {
    await createAdminClient().rpc("claim_guest_bookings", { p_user_id: data.user.id, p_email: email.data });
  } catch (err) {
    await logEvent("auth.claim", errorMessage(err), { user_id: data.user.id }, "warning");
  }
  redirect(safeNext(formData.get("next")));
}

/** Connexion Google, Apple, Microsoft… (OAuth PKCE géré par Supabase Auth). */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = String(formData.get("provider") ?? "") as OAuthProviderId;
  if (!OAUTH_PROVIDERS.some((p) => p.id === provider)) redirect("/login?error=provider");
  const next = safeNext(formData.get("next"));
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${env.appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      ...(provider === "azure" ? { scopes: "email" } : {}),
    },
  });
  if (error || !data.url) redirect("/login?error=provider");
  redirect(data.url);
}

/** Déconnecte la session sur tous les appareils (révocation des jetons de rafraîchissement). */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/");
}
