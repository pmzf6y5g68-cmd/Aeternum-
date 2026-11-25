import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signUnsubscribe, verifySvix, verifyUnsubscribe } from "@/lib/unsubscribe";

const SECRET = "test-unsub-secret";

describe("désinscription en 1 clic", () => {
  it("jeton identique à celui du robot Python", () => {
    expect(signUnsubscribe("Julie@Elegance.fr", SECRET)).toBe("anVsaWVAZWxlZ2FuY2UuZnI.RR0dO_5aIYepGiDxcfy6I4WKNFDvwweix0J_-gV2dJI");
  });
  it("vérifie et normalise l'email", () => {
    expect(verifyUnsubscribe(signUnsubscribe("Julie@Elegance.fr", SECRET), SECRET)).toBe("julie@elegance.fr");
  });
  it("rejette jeton falsifié, autre secret ou malformé", () => {
    const [, sig] = signUnsubscribe("a@b.fr", SECRET).split(".");
    expect(verifyUnsubscribe(`${Buffer.from("victime@x.fr").toString("base64url")}.${sig}`, SECRET)).toBeNull();
    expect(verifyUnsubscribe(signUnsubscribe("a@b.fr", SECRET), "autre")).toBeNull();
    expect(verifyUnsubscribe("x", SECRET)).toBeNull();
    expect(verifyUnsubscribe(null, SECRET)).toBeNull();
  });
});

describe("webhook Resend (Svix)", () => {
  const secret = `whsec_${Buffer.from("cle-de-test-32-octets-exactement!").toString("base64")}`;
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "e1", to: ["x@y.fr"] } });
  const now = 1_764_000_000_000;
  const ts = String(Math.floor(now / 1000));
  const sign = (payload: string) =>
    createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_1.${ts}.${payload}`).digest("base64");

  it("accepte une signature valide (parmi plusieurs)", () => {
    expect(verifySvix(body, { id: "msg_1", timestamp: ts, signature: `v1,invalide v1,${sign(body)}` }, secret, now)).toBe(true);
  });
  it("rejette corps modifié, horodatage trop ancien ou en-têtes absents", () => {
    expect(verifySvix(`${body} `, { id: "msg_1", timestamp: ts, signature: `v1,${sign(body)}` }, secret, now)).toBe(false);
    expect(verifySvix(body, { id: "msg_1", timestamp: ts, signature: `v1,${sign(body)}` }, secret, now + 600_000)).toBe(false);
    expect(verifySvix(body, { id: null, timestamp: ts, signature: "v1,x" }, secret, now)).toBe(false);
  });
});
