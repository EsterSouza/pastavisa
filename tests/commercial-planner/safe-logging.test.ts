import { afterEach, describe, expect, it, vi } from "vitest";
import { logPlannerRequest } from "@/lib/commercial-planner/safe-logging";

afterEach(() => vi.restoreAllMocks());

describe("safe planner logging", () => {
  it("registra somente identificador, duracao, status e quantidades", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logPlannerRequest({
      requestId: "request-id",
      durationMs: 12,
      status: 200,
      quantities: { payloadBytes: 100, procedureBytes: 20, procedures: 2, documents: 3 },
    });

    expect(info).toHaveBeenCalledWith(JSON.stringify({
      requestId: "request-id",
      durationMs: 12,
      status: 200,
      quantities: { payloadBytes: 100, procedureBytes: 20, procedures: 2, documents: 3 },
    }));
  });
});
