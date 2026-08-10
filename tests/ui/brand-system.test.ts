import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("brand system", () => {
  it("centraliza a paleta do manual em tokens semânticos", () => {
    const globals = read("app/globals.css");

    for (const token of [
      "--color-navy-deep: 7 24 46",
      "--color-navy: 11 31 58",
      "--color-blue: 36 74 155",
      "--color-blue-light: 111 149 246",
      "--color-blue-pale: 234 243 252",
      "--color-amber: 217 151 33",
    ]) {
      expect(globals).toContain(token);
    }

    expect(globals).toContain("min-height: 2.75rem");
    expect(globals).toContain(":focus-visible");
  });

  it("separa shells público e interno sem mudar as rotas", () => {
    expect(fs.existsSync(path.join(root, "app/(internal)/layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "app/(public)/layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "app/(public)/login/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "app/(internal)/pasta/nova/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "app/login/page.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(root, "app/pasta/nova/page.tsx"))).toBe(false);
  });

  it("usa o ativo oficial claro e não expõe a navegação administrativa no login", () => {
    expect(fs.existsSync(path.join(root, "public/brand/treinavisa-logo-light.png"))).toBe(true);
    expect(read("components/brand/BrandLogo.tsx")).toContain("/brand/treinavisa-logo-light.png");

    const publicLayout = read("app/(public)/layout.tsx");
    expect(publicLayout).toContain("BrandLogo");
    expect(publicLayout).not.toContain("Templates");
    expect(publicLayout).not.toContain("Legislações");
  });
});
