// @vitest-environment jsdom
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";

/**
 * Acessibilidade do modal de preview do fluxo de correção.
 *
 * Enquanto ele está aberto é a única coisa navegável: sem tratamento de teclado, o
 * operador que usa Tab saía do diálogo para a lista de documentos por baixo dele e
 * não tinha como fechar sem mouse.
 *
 * Usa `createElement` em vez de JSX porque a configuração de teste do projeto não
 * transforma JSX — trocá-la afetaria todos os outros arquivos de teste.
 */

const PREVIEW: DocumentPreviewState = {
  title: "MBP.docx",
  html: '<a href="#nota">nota de rodapé</a>',
  loading: false,
};

function modal(preview: DocumentPreviewState | null, onClose: () => void) {
  return createElement(DocumentPreviewModal, { preview, onClose });
}

function abrir(onClose = vi.fn()) {
  const gatilho = document.createElement("button");
  gatilho.textContent = "Visualizar";
  document.body.appendChild(gatilho);
  gatilho.focus();

  const utils = render(modal(PREVIEW, onClose));
  return { gatilho, onClose, ...utils };
}

describe("DocumentPreviewModal", () => {
  it("se anuncia como diálogo modal com título ligado", () => {
    abrir();

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleName("Visualizar documento");
    cleanup();
  });

  it("move o foco para Fechar ao abrir", () => {
    abrir();

    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
    cleanup();
  });

  it("fecha com Esc", () => {
    const { onClose } = abrir();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
  });

  it("fecha ao clicar fora do diálogo, mas não ao clicar dentro", () => {
    const { onClose } = abrir();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    // O backdrop é o pai direto do diálogo.
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
  });

  it("mantém o Tab circulando dentro do diálogo", () => {
    abrir();

    const fechar = screen.getByRole("button", { name: "Fechar" });
    const link = screen.getByRole("link", { name: "nota de rodapé" });

    // Do último foco em diante o Tab volta ao primeiro, em vez de escapar para a
    // página por baixo.
    link.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(fechar).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(link).toHaveFocus();
    cleanup();
  });

  it("devolve o foco a quem abriu quando fecha", () => {
    const { gatilho, rerender } = abrir();

    rerender(modal(null, vi.fn()));

    expect(gatilho).toHaveFocus();
    cleanup();
  });

  it("anuncia carregamento em região viva", () => {
    const { container } = render(
      modal({ title: "MBP.docx", html: "", loading: true }, vi.fn())
    );

    const regiao = container.querySelector('[aria-live="polite"]');
    expect(regiao).toBeTruthy();
    expect(regiao?.textContent).toContain("Carregando preview");
    cleanup();
  });
});
