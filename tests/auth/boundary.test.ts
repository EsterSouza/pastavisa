import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/supabase/browser";

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.isFile() && entry.name === "route.ts" ? [full] : [];
  });
}

describe("auth boundary", () => {
  it("bloqueia open redirect", () => {
    expect(safeNextPath("/pasta/123?tab=documentos")).toBe("/pasta/123?tab=documentos");
    expect(safeNextPath("https://evil.test")).toBe("/");
    expect(safeNextPath("//evil.test/path")).toBe("/");
    expect(safeNextPath("/\\evil.test/path")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("nao oferece cadastro e remove a sessao temporaria", () => {
    const root = process.cwd();
    const login = fs.readFileSync(path.join(root, "app/login/page.tsx"), "utf8");
    const authLogin = fs.readFileSync(path.join(root, "app/api/auth/login/route.ts"), "utf8");
    expect(`${login}\n${authLogin}`).not.toMatch(/sign\s?up/i);
    expect(fs.existsSync(path.join(root, "lib/session-auth.ts"))).toBe(false);
  });

  it("protege todo DELETE novamente no handler", () => {
    const files = routeFiles(path.join(process.cwd(), "app/api"));
    const destructive = files.filter((file) =>
      fs.readFileSync(file, "utf8").includes("export async function DELETE")
    );
    expect(destructive.length).toBeGreaterThan(0);
    destructive.forEach((file) =>
      expect(fs.readFileSync(file, "utf8"), path.relative(process.cwd(), file)).toContain("requireAdmin")
    );
  });
});
