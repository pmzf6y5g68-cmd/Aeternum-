/**
 * Jeton signé HMAC-SHA256 pour les liens d'onboarding pré-remplis envoyés par l'agent email.
 * Format : base64url(JSON payload) + "." + base64url(HMAC).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface PrefillData {
  name: string;
  city: string;
  email: string;
}

interface PrefillPayload extends PrefillData {
  exp: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signPrefill(data: PrefillData, secret: string, nowMs: number = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS): string {
  if (!secret) throw new Error("PREFILL_SECRET manquant");
  const payload: PrefillPayload = {
    name: data.name.slice(0, 120),
    city: data.city.slice(0, 80),
    email: data.email.trim().toLowerCase().slice(0, 200),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifyPrefill(token: string | null | undefined, secret: string, nowMs: number = Date.now()): PrefillData | null {
  if (!token || !secret) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<PrefillPayload>;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < nowMs) return null;
    if (typeof payload.name !== "string" || typeof payload.city !== "string" || typeof payload.email !== "string") return null;
    return { name: payload.name, city: payload.city, email: payload.email };
  } catch {
    return null;
  }
}

/** Comparaison de secrets en temps constant (webhooks, crons). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
