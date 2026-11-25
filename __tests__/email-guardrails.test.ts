import { describe, expect, it } from "vitest";
import {
  MAX_AI_REPLIES,
  containsStopKeyword,
  evaluateGuardrails,
  isAutomatedMessage,
  isSystemAddress,
  stripQuotedReply,
  type InboundEmail,
} from "@/lib/ai/email-guardrails";
import { safeEqual, signPrefill, verifyPrefill } from "@/lib/prefill";

function email(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    from: "Julien <julien@detailing-lyon.fr>",
    to: "bonjour@slotly.fr",
    subject: "Re: Votre page de réservation",
    text: "Bonjour, ça m'intéresse, comment ça marche ?",
    messageId: "<abc@mail.gmail.com>",
    inReplyTo: "<out-1@slotly.fr>",
    references: "<out-1@slotly.fr>",
    headers: {},
    ...overrides,
  };
}

const own = ["bonjour@slotly.fr"];

describe("adresses système & bounces", () => {
  it.each(["mailer-daemon@googlemail.com", "MAILER-DAEMON@mx.example.com", "noreply@stripe.com", "no-reply@x.fr", "postmaster@orange.fr", "do-not-reply@a.io", "bounce+123@x.com"])(
    "%s est rejeté avant tout appel IA",
    (from) => {
      expect(isSystemAddress(from)).toBe(true);
      expect(evaluateGuardrails({ email: email({ from }), thread: null, ownAddresses: own })).toEqual({ action: "drop", reason: "system_address" });
    },
  );

  it("une adresse humaine passe", () => {
    expect(isSystemAddress("julien@detailing-lyon.fr")).toBe(false);
  });

  it("ignore nos propres envois", () => {
    expect(evaluateGuardrails({ email: email({ from: "Slotly <bonjour@slotly.fr>" }), thread: null, ownAddresses: own }).action).toBe("drop");
  });
});

describe("en-têtes automatiques", () => {
  it.each<Record<string, string>>([
    { "auto-submitted": "auto-generated" },
    { "auto-submitted": "auto-replied" },
    { precedence: "bulk" },
    { precedence: "list" },
    { precedence: "auto_reply" },
    { "x-autoreply": "yes" },
    { "list-id": "<news.example.com>" },
  ])("%o est rejeté", (headers) => {
    expect(isAutomatedMessage(headers)).toBe(true);
    expect(evaluateGuardrails({ email: email({ headers }), thread: null, ownAddresses: own })).toEqual({ action: "drop", reason: "automated_header" });
  });

  it("Auto-Submitted: no n'est pas automatique", () => {
    expect(isAutomatedMessage({ "auto-submitted": "no" })).toBe(false);
  });

  it("un répondeur d'absence met le prospect en pause sans IA", () => {
    const decision = evaluateGuardrails({
      email: email({ subject: "Réponse automatique : absent du bureau", headers: { "auto-submitted": "auto-replied" } }),
      thread: null,
      ownAddresses: own,
    });
    expect(decision).toEqual({ action: "ooo_pause", reason: "out_of_office" });
  });
});

describe("opt-out immédiat", () => {
  it.each(["STOP", "Stop merci", "stop.", "Merci de me désinscrire", "Je veux me désabonner", "unsubscribe", "Please UNSUBSCRIBE me", "Retirez-moi de votre liste"])(
    "« %s » déclenche l'opt-out sans réponse",
    (text) => {
      expect(evaluateGuardrails({ email: email({ text }), thread: null, ownAddresses: own })).toEqual({ action: "opt_out", reason: "stop_keyword" });
    },
  );

  it("détecte STOP dans l'objet", () => {
    expect(containsStopKeyword("STOP", "")).toBe(true);
  });

  it("ignore le mot présent uniquement dans la citation", () => {
    const text = "Oui je suis intéressé !\n\nLe lun. 23 nov. 2026, Slotly a écrit :\n> Répondez STOP pour ne plus être contacté.";
    expect(containsStopKeyword("Re: Slotly", text)).toBe(false);
    expect(evaluateGuardrails({ email: email({ text }), thread: null, ownAddresses: own }).action).toBe("ai");
  });

  it("pas de faux positif sur « non-stop » ou « arrêt maladie »", () => {
    expect(containsStopKeyword("", "On travaille non-stop le samedi")).toBe(false);
    expect(containsStopKeyword("", "Je suis en arrêt maladie jusqu'à lundi")).toBe(false);
  });

  it("un fil déjà stoppé est ignoré", () => {
    expect(evaluateGuardrails({ email: email(), thread: { status: "stopped", ai_reply_count: 0 }, ownAddresses: own })).toEqual({ action: "drop", reason: "thread_stopped" });
  });
});

describe("plafond de réponses IA", () => {
  it(`ai_reply_count >= ${MAX_AI_REPLIES} force l'escalade humaine`, () => {
    for (const count of [4, 5, 12]) {
      expect(evaluateGuardrails({ email: email(), thread: { status: "ai_handled", ai_reply_count: count }, ownAddresses: own })).toEqual({ action: "escalate", reason: "reply_cap" });
    }
  });

  it("sous le plafond, l'IA est autorisée", () => {
    expect(evaluateGuardrails({ email: email(), thread: { status: "ai_handled", ai_reply_count: 3 }, ownAddresses: own })).toEqual({ action: "ai" });
  });

  it("un fil déjà escaladé reste chez l'humain", () => {
    expect(evaluateGuardrails({ email: email(), thread: { status: "escalated", ai_reply_count: 1 }, ownAddresses: own })).toEqual({ action: "escalate", reason: "already_escalated" });
  });

  it("STOP reste prioritaire même au-delà du plafond", () => {
    expect(evaluateGuardrails({ email: email({ text: "STOP" }), thread: { status: "ai_handled", ai_reply_count: 9 }, ownAddresses: own }).action).toBe("opt_out");
  });

  it("corps vide (seulement une citation) : ignoré", () => {
    expect(evaluateGuardrails({ email: email({ text: "> ancien message" }), thread: null, ownAddresses: own })).toEqual({ action: "drop", reason: "empty_body" });
  });
});

describe("citations", () => {
  it("retire l'historique Gmail / Outlook", () => {
    expect(stripQuotedReply("Ok pour moi\nOn Mon, Nov 23, 2026 at 9:00 AM Slotly wrote:\n> blabla")).toBe("Ok pour moi");
    expect(stripQuotedReply("Parfait\n-----Original Message-----\nFrom: x")).toBe("Parfait");
  });
});

describe("jeton HMAC prefill", () => {
  const secret = "test-secret-très-long";
  const data = { name: "Shine Detailing", city: "Lyon", email: "Julien@Detailing-Lyon.fr" };

  it("signe puis vérifie", () => {
    const token = signPrefill(data, secret);
    expect(verifyPrefill(token, secret)).toEqual({ name: "Shine Detailing", city: "Lyon", email: "julien@detailing-lyon.fr" });
  });

  it("rejette un payload modifié", () => {
    const token = signPrefill(data, secret);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...data, email: "pirate@x.fr", exp: 9999999999 })).toString("base64url");
    expect(verifyPrefill(`${forged}.${sig}`, secret)).toBeNull();
  });

  it("rejette une mauvaise clé, un jeton expiré ou malformé", () => {
    const now = Date.now();
    const token = signPrefill(data, secret, now, 60);
    expect(verifyPrefill(token, "autre-secret")).toBeNull();
    expect(verifyPrefill(token, secret, now + 61_000)).toBeNull();
    expect(verifyPrefill("n'importe quoi", secret)).toBeNull();
    expect(verifyPrefill(`${token}.x`, secret)).toBeNull();
    expect(verifyPrefill(null, secret)).toBeNull();
  });

  it("comparaison en temps constant", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual(null, "abc")).toBe(false);
  });
});
