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

  it("usa os ativos oficiais para superfícies claras e escuras", () => {
    for (const asset of [
      "public/brand/treinavisa-logo-on-light.png",
      "public/brand/treinavisa-logo-on-dark.png",
      "public/brand/favicon-light.png",
      "public/brand/favicon-dark.png",
    ]) {
      expect(fs.existsSync(path.join(root, asset))).toBe(true);
    }

    const logo = read("components/brand/BrandLogo.tsx");
    expect(logo).toContain("/brand/treinavisa-logo-on-light.png");
    expect(logo).toContain("/brand/treinavisa-logo-on-dark.png");

    const publicLayout = read("app/(public)/layout.tsx");
    expect(publicLayout).toContain("BrandLogo");
    expect(publicLayout).toContain("ThemeToggle");
    expect(publicLayout).not.toContain("Templates");
    expect(publicLayout).not.toContain("Legislações");
  });

  it("oferece tema persistente sem flash e superfícies semânticas", () => {
    const rootLayout = read("app/layout.tsx");
    const globals = read("app/globals.css");
    const shell = read("components/shell/AppShell.tsx");

    expect(rootLayout).toContain("pastavisa-theme");
    expect(rootLayout).toContain("prefers-color-scheme: dark");
    expect(globals).toContain(':root[data-theme="dark"]');
    expect(globals).toContain("--color-surface-card");
    expect(shell).toContain("ThemeToggle");
  });

  it("mantem o anel de foco acima de 3:1 nos dois temas", () => {
    const globals = read("app/globals.css");

    const bloco = (seletor: string) => {
      const inicio = globals.indexOf(seletor);
      expect(inicio).toBeGreaterThan(-1);
      const corpo = globals.slice(inicio, globals.indexOf("}", inicio));
      const tokens = new Map<string, string>();
      const declaracao = /(--color-[\w-]+):\s*([^;]+);/g;
      let achado: RegExpExecArray | null;
      while ((achado = declaracao.exec(corpo)) !== null) {
        tokens.set(achado[1], achado[2].trim());
      }
      return tokens;
    };

    const claro = bloco(":root {");
    const escuro = bloco(':root[data-theme="dark"] {');

    // Resolve um nivel de var() e cai no tema claro quando o escuro nao redefine.
    const rgb = (tokens: Map<string, string>, nome: string): [number, number, number] => {
      let valor = tokens.get(nome) ?? claro.get(nome);
      const ref = valor?.match(/var\((--[\w-]+)\)/);
      if (ref) valor = tokens.get(ref[1]) ?? claro.get(ref[1]);
      const partes = (valor ?? "").split(/\s+/).map(Number);
      expect(partes).toHaveLength(3);
      return partes as [number, number, number];
    };

    const luminancia = ([r, g, b]: [number, number, number]) => {
      const canal = (v: number) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };

    const razao = (a: [number, number, number], b: [number, number, number]) => {
      const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };

    // WCAG 2.2 SC 1.4.11: indicador de foco precisa de 3:1 contra o que o cerca.
    const superficies = ["--color-surface-page", "--color-surface-card", "--color-surface-subtle", "--color-shell-bg"];
    for (const [tema, tokens] of [["claro", claro], ["escuro", escuro]] as const) {
      const anel = rgb(tokens, "--color-focus-ring");
      for (const superficie of superficies) {
        const valor = razao(anel, rgb(tokens, superficie));
        expect(valor, `anel de foco sobre ${superficie} no tema ${tema}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("quebra token sem espaco vindo do banco", () => {
    // Titulo de legislacao traz URL de centenas de caracteres; sem esta regra um
    // unico token empurrava a pagina em 600px no desktop.
    const globals = read("app/globals.css");
    const corpo = globals.slice(globals.indexOf("body {"), globals.indexOf("}", globals.indexOf("body {")));
    expect(corpo).toContain("overflow-wrap: break-word");
  });
});
