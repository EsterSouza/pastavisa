import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("planner Vercel firewall specification", () => {
  it("limita somente POST por IP e retorna 429", () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "scripts/planner-firewall-rules.json"), "utf8")
    );
    expect(config.rules).toEqual([
      expect.objectContaining({
        paths: [
          "/api/planejamento-comercial/analisar",
          "/api/planejamento-comercial/pdf",
        ],
        method: "POST",
        windowSeconds: 300,
        requests: 10,
        key: "ip",
        action: "rate_limit",
        status: 429,
      }),
    ]);
  });
});
