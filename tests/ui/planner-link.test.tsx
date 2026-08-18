// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannerLink } from "@/components/shell/PlannerLink";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

// O projeto não liga os globals do Vitest, então o React Testing Library não
// registra a limpeza automática e um render vaza para o teste seguinte.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("link do pré-planejamento comercial", () => {
  it("mostra a URL absoluta, que é o que se cola numa conversa", () => {
    render(<PlannerLink />);
    const campo = screen.getByLabelText("Link do pré-planejamento comercial") as HTMLInputElement;
    expect(campo.value).toBe(`${window.location.origin}/planner`);
    expect(campo.readOnly).toBe(true);
  });

  it("copia para a área de transferência e confirma", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<PlannerLink />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/planner`);
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("sem clipboard, deixa a URL selecionada em vez de quebrar", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    render(<PlannerLink />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    const campo = screen.getByLabelText("Link do pré-planejamento comercial") as HTMLInputElement;
    expect(campo.selectionStart).toBe(0);
    expect(campo.selectionEnd).toBe(campo.value.length);
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();

    vi.unstubAllGlobals();
  });
});

describe("o planner continua fora da navegação autenticada", () => {
  it("o menu interno não ganha item para /planner", () => {
    // Regra global 7 do handoff: o planner é público e sem login. Um item de menu
    // daria a ele porta de entrada autenticada; o que existe é campo de cópia.
    const shell = read("components/shell/AppShell.tsx");
    const navegacao = shell.slice(shell.indexOf("const navigation"), shell.indexOf("function NavigationLinks"));

    expect(navegacao).not.toContain("/planner");
    expect(shell).toContain("<PlannerLink />");
  });

  it("o middleware mantém /planner como rota pública", () => {
    expect(read("middleware.ts")).toContain("/planner");
  });
});
