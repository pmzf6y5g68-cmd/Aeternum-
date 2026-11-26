import { describe, expect, it, vi } from "vitest";
import { ASSISTANT_MAX_TOOL_ROUNDS, assistantRequestSchema, runAssistant, type AssistantClient, type ToolExecutor } from "@/lib/ai/assistant";

type Reply = { stop_reason: string; content: unknown[] };

function client(replies: Reply[]) {
  const calls: Record<string, unknown>[] = [];
  const c = {
    beta: {
      messages: {
        create: vi.fn(async (params: Record<string, unknown>) => {
          calls.push(JSON.parse(JSON.stringify(params)));
          return replies.shift() ?? { stop_reason: "end_turn", content: [{ type: "text", text: "Fin." }] };
        }),
      },
    },
  } as unknown as AssistantClient;
  return { c, calls };
}

const request = assistantRequestSchema.parse({ messages: [{ role: "user", content: "Un barbier demain à Lyon" }] });

describe("assistant IA", () => {
  it("appelle les outils, renvoie les résultats au modèle et collecte les cartes", async () => {
    const { c, calls } = client([
      { stop_reason: "tool_use", content: [{ type: "text", text: "Je cherche." }, { type: "tool_use", id: "t1", name: "search_businesses", input: { query: "barbier", place: "Lyon" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Voici 1 barbier disponible demain." }] },
    ]);
    const execute: ToolExecutor = vi.fn(async () => ({
      content: '{"results":[]}',
      cards: [{ type: "link" as const, label: "Barbier", href: "/barbier/lyon/x" }],
    }));
    const out = await runAssistant(request, { client: c, execute, model: "claude-opus-5-5", userId: null });
    expect(out.reply).toBe("Voici 1 barbier disponible demain.");
    expect(out.cards).toHaveLength(1);
    expect(execute).toHaveBeenCalledWith("search_businesses", { query: "barbier", place: "Lyon" }, { userId: null, location: null });
    const second = calls[1] as { messages: { role: string; content: unknown }[] };
    expect(second.messages[1]?.role).toBe("system");
    expect(second.messages[2]?.role).toBe("assistant");
    expect(second.messages[3]).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1" }] });
    expect(calls[0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" } });
  });

  it("signale le relais humain et isole les erreurs d'outil", async () => {
    const { c, calls } = client([{ stop_reason: "tool_use", content: [{ type: "tool_use", id: "h", name: "handoff_to_human", input: { summary: "Remboursement" } }] }]);
    const out = await runAssistant(request, {
      client: c,
      execute: async () => {
        throw new Error("db down");
      },
      model: "m",
      userId: "u1",
    });
    expect(out.handoff).toBe(true);
    expect((calls[1] as { messages: { content: unknown }[] }).messages[3]?.content).toMatchObject([{ is_error: true }]);
  });

  it("exécute plusieurs outils en parallèle et garde l'ordre des résultats", async () => {
    const { c, calls } = client([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "a", name: "get_business_details", input: { business_slug: "x" } }, { type: "tool_use", id: "b", name: "price_overview", input: { category: "coiffeur" } }] },
    ]);
    let running = 0;
    let peak = 0;
    const execute: ToolExecutor = async (name) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return { content: name };
    };
    await runAssistant(request, { client: c, execute, model: "m", userId: null });
    expect(peak).toBe(2);
    expect((calls[1] as { messages: { content: unknown }[] }).messages[3]?.content).toMatchObject([{ tool_use_id: "a", content: "get_business_details" }, { tool_use_id: "b", content: "price_overview" }]);
  });

  it("prompt système stable (cache) et contexte de page en message système", async () => {
    const { c, calls } = client([]);
    const onPage = assistantRequestSchema.parse({ messages: [{ role: "user", content: "Ils ouvrent à quelle heure ?" }], page: "/coiffeur/lyon/salon-test" });
    await runAssistant(onPage, { client: c, execute: async () => ({ content: "" }), model: "m", userId: null, now: new Date("2026-11-26T10:00:00Z") });
    const first = calls[0] as { system: { text: string }[]; messages: { role: string; content: string }[] };
    expect(first.system[0]?.text).not.toContain("2026");
    expect(first.messages[1]).toMatchObject({ role: "system" });
    expect(first.messages[1]?.content).toContain("salon-test");
  });

  it("refus du modèle : message poli, jamais d'erreur brute", async () => {
    const { c } = client([{ stop_reason: "refusal", content: [] }]);
    const out = await runAssistant(request, { client: c, execute: async () => ({ content: "" }), model: "m", userId: null });
    expect(out.reply).toContain("Je ne peux pas vous aider");
  });

  it("borne le nombre de tours d'outils puis force une conclusion", async () => {
    const loop = Array.from({ length: 10 }, (_, i) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: `t${i}`, name: "search_businesses", input: {} }] }));
    const { c, calls } = client(loop);
    await runAssistant(request, { client: c, execute: async () => ({ content: "{}" }), model: "m", userId: null });
    expect(calls).toHaveLength(ASSISTANT_MAX_TOOL_ROUNDS + 1);
    expect(calls[ASSISTANT_MAX_TOOL_ROUNDS]).toMatchObject({ tool_choice: { type: "none" } });
  });

  it("valide la requête (dernier message usager, longueurs)", () => {
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "assistant", content: "x" }] }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(1501) }] }).success).toBe(false);
  });
});
