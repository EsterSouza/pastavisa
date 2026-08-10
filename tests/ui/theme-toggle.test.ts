import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nextTheme, THEME_STORAGE_KEY } from "@/components/theme/theme";

describe("ThemeToggle", () => {
  it("alterna entre os dois temas", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme(undefined)).toBe("dark");
  });

  it("persiste a escolha no armazenamento local", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/theme/ThemeToggle.tsx"), "utf8");
    expect(THEME_STORAGE_KEY).toBe("pastavisa-theme");
    expect(source).toContain("localStorage.setItem(THEME_STORAGE_KEY, theme)");
  });
});
