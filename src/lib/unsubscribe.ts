/**
 * Jetons de désinscription (RFC 8058) partagés avec scripts/prospector.py :
 * base64url(email) + "." + base64url(HMAC-SHA256(secret, "unsub:" + email)).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function signUnsubscribe(email: string, secret: string): string {
  const normalized = email.trim().toLowerCase();
  const sig = createHmac("sha256", secret).update(`unsub:${normalized}`).digest("base64url");
  return `${Buffer.from(normalized).toString("base64url")}.${sig}`;
}

export function verifyUnsubscribe(token: string | null | undefined, secret: string): string | null {
  if (!token || !secret) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const email = Buffer.from(body, "base64url").toString("utf8");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const expected = Buffer.from(signUnsubscribe(email, secret).split(".")[1] ?? "");
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? email : null;
}

/**
 * Vérification d'un webhook signé Svix (utilisé par Resend) :
 * signature = base64(HMAC-SHA256(base64decode(secret sans "whsec_"), `${id}.${timestamp}.${body}`)).
 */
export function verifySvix(
  payload: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowMs: number = Date.now(),
  toleranceSeconds = 300,
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > toleranceSeconds) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${payload}`).digest();
  return headers.signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
