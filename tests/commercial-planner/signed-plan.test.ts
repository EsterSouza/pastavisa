import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let signPlan: typeof import("@/lib/commercial-planner/signed-plan").signPlan;
let verifyPlan: typeof import("@/lib/commercial-planner/signed-plan").verifyPlan;

beforeAll(async () => {
  ({ signPlan, verifyPlan } = await import("@/lib/commercial-planner/signed-plan"));
});

const secret = "test-only-planner-signing-secret";

describe("signed commercial plan", () => {
  it("aceita o token durante duas horas", () => {
    const token = signPlan({ preco: { valorTotal: 597 } }, { secret, now: 1_000 });
    expect(verifyPlan(token, { secret, now: 1_000 + 7_199 }).plan).toEqual({
      preco: { valorTotal: 597 },
    });
  });

  it("rejeita token expirado", () => {
    const token = signPlan({ ok: true }, { secret, now: 1_000 });
    expect(() => verifyPlan(token, { secret, now: 1_000 + 7_200 })).toThrow("inválido");
  });

  it("rejeita token alterado", () => {
    const [payload, digest] = signPlan({ ok: true }, { secret, now: 1_000 }).split(".");
    const altered = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}.${digest}`;
    expect(() => verifyPlan(altered, { secret, now: 1_001 })).toThrow("inválido");
  });

  it("rejeita preco forjado no payload", () => {
    const [payload, digest] = signPlan({ preco: { valorTotal: 597 } }, { secret, now: 1_000 }).split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.plan.preco.valorTotal = 1;
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(() => verifyPlan(`${forgedPayload}.${digest}`, { secret, now: 1_001 })).toThrow("inválido");
  });
});
