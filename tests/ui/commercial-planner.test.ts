// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CommercialPlanner } from "@/components/commercial-planner/CommercialPlanner";
import { DRAFT_KEY } from "@/lib/commercial-planner/draft";

/**
 * Fluxo público do comercial: cliente → operação → revisão → formato → PDF.
 *
 * Usa `createElement` porque os arquivos de teste são `.ts` e não passam por
 * transformação de JSX; os componentes `.tsx` passam.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/planner" }));

const plano = {
  procedimentos: ["Limpeza de pele", "Microagulhamento"],
  documentos: [
    { nome: "POP - Limpeza de pele", tipo: "POP" },
    { nome: "POP - Microagulhamento", tipo: "POP" },
    { nome: "Manual de Boas Práticas", tipo: "MBP" },
  ],
  vinculos: [
    { documento: "POP - Limpeza de pele", tipo: "POP", procedimentos: ["Limpeza de pele"] },
    { documento: "POP - Microagulhamento", tipo: "POP", procedimentos: ["Microagulhamento"] },
    { documento: "Manual de Boas Práticas", tipo: "MBP", procedimentos: [] },
  ],
  alertas: ["A documentação de Microagulhamento precisa de validação técnica antes da produção final."],
  resumo: { totalProcedimentos: 2, totalDocumentos: 3, revisaoTecnicaObrigatoria: true },
  aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
  token: "token-assinado",
  preco: { formato: "digital", valorBase: 597, valorAdicional: 0, valorTotal: 597, moeda: "BRL" },
  prazo: { diasUteis: 15, sujeitoConfirmacaoTecnica: false },
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => plano });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function preencher(valor: string, rotulo: RegExp) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

async function chegarNaRevisao() {
  render(createElement(CommercialPlanner));
  preencher("Clínica Aurora", /nome do cliente/i);
  fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
  preencher("Limpeza de pele e microagulhamento", /procedimentos realizados/i);
  fireEvent.click(screen.getByRole("button", { name: /analisar operação/i }));
  await screen.findByRole("heading", { name: /revise o que entra na pasta/i });
}

describe("planner comercial público", () => {
  it("caminha do cliente até a revisão pelo teclado, sem exigir mouse", async () => {
    render(createElement(CommercialPlanner));

    const cliente = screen.getByLabelText(/nome do cliente/i);
    cliente.focus();
    expect(document.activeElement).toBe(cliente);
    fireEvent.change(cliente, { target: { value: "Clínica Aurora" } });

    const continuar = screen.getByRole("button", { name: /continuar/i });
    expect(continuar).toBeEnabled();
    fireEvent.click(continuar);

    const procedimentos = await screen.findByLabelText(/procedimentos realizados/i);
    procedimentos.focus();
    expect(document.activeElement).toBe(procedimentos);
    fireEvent.change(procedimentos, { target: { value: "Limpeza de pele" } });
    fireEvent.click(screen.getByRole("button", { name: /analisar operação/i }));

    await screen.findByRole("heading", { name: /revise o que entra na pasta/i });
    expect(fetchMock).toHaveBeenCalledWith("/api/planejamento-comercial/analisar", expect.objectContaining({ method: "POST" }));
  });

  it("a retirada recalcula documentos e contagem na hora", async () => {
    await chegarNaRevisao();

    const procedimentos = within(screen.getByRole("region", { name: /procedimentos/i }));
    expect(screen.getByText("POP - Microagulhamento")).toBeInTheDocument();
    expect(procedimentos.getByText("2 de 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /microagulhamento/i }));

    await waitFor(() => expect(screen.queryByText("POP - Microagulhamento")).not.toBeInTheDocument());
    expect(procedimentos.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText("2 documento(s)")).toBeInTheDocument();
    expect(screen.getByText("Manual de Boas Práticas")).toBeInTheDocument();
  });

  it("compara os três formatos e envia token, formato e retirados ao gerar o PDF", async () => {
    await chegarNaRevisao();
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    await screen.findByRole("heading", { name: /escolha o formato de entrega/i });
    const formatos = within(screen.getByRole("group", { name: /formato de entrega/i }));
    expect(formatos.getByText("R$ 597,00")).toBeInTheDocument();
    expect(formatos.getByText("R$ 797,00")).toBeInTheDocument();
    expect(formatos.getByText("R$ 957,00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /impressa colorida/i }));

    const criarObjectUrl = vi.fn(() => "blob:pdf");
    vi.stubGlobal("URL", { ...URL, createObjectURL: criarObjectUrl, revokeObjectURL: vi.fn() });
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF-"]) });

    fireEvent.click(screen.getByRole("button", { name: /baixar pdf/i }));

    await waitFor(() => expect(criarObjectUrl).toHaveBeenCalled());
    const [rota, opcoes] = fetchMock.mock.calls.at(-1)!;
    expect(rota).toBe("/api/planejamento-comercial/pdf");
    expect(JSON.parse(opcoes.body)).toEqual({ token: "token-assinado", formato: "colorida", retirados: [] });
  });

  it("mostra o erro do servidor sem inventar sucesso", async () => {
    render(createElement(CommercialPlanner));
    preencher("Clínica Aurora", /nome do cliente/i);
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    preencher("Limpeza de pele", /procedimentos realizados/i);

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "O planejamento está temporariamente indisponível." }) });
    fireEvent.click(screen.getByRole("button", { name: /analisar operação/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("temporariamente indisponível");
    expect(screen.queryByRole("heading", { name: /revise o que entra/i })).not.toBeInTheDocument();
  });

  it("marca na tela a ressalva de legislação que não sai no PDF", async () => {
    // O comercial precisa saber que o cliente não leu aquilo no documento; sem a
    // marca ele trata o assunto como já dito.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ...plano,
        alertas: [
          "A documentação de Microagulhamento precisa de validação técnica antes da produção final.",
          "Câmara de bronzeamento artificial não pode ser usada para fins estéticos.",
        ],
        // Quem classifica é o servidor, que é também quem tira a linha do token do PDF.
        alertasReservados: ["Câmara de bronzeamento artificial não pode ser usada para fins estéticos."],
      }),
    });

    await chegarNaRevisao();

    const legislacao = screen.getByText(/câmara de bronzeamento artificial/i).closest("li");
    expect(legislacao).toHaveTextContent("não sai no PDF");

    const tecnico = screen.getByText(/validação técnica antes da produção final/i).closest("li");
    expect(tecnico).not.toHaveTextContent("não sai no PDF");
  });

  it("só toca o armazenamento do navegador pelo módulo de rascunho", () => {
    const componentes = [
      "components/commercial-planner/CommercialPlanner.tsx",
      "components/commercial-planner/ReviewStep.tsx",
      "components/commercial-planner/FormatStep.tsx",
      "components/commercial-planner/PlannerFields.tsx",
      "components/commercial-planner/PlannerSteps.tsx",
    ];

    for (const componente of componentes) {
      const fonte = readFileSync(join(process.cwd(), componente), "utf8");
      expect(fonte).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
    }
  });

  it("retoma o atendimento guardado e o descarta ao recomeçar do zero", async () => {
    const dados = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (chave: string) => dados.get(chave) ?? null,
        setItem: (chave: string, valor: string) => void dados.set(chave, valor),
        removeItem: (chave: string) => void dados.delete(chave),
        clear: () => dados.clear(),
        key: () => null,
        get length() {
          return dados.size;
        },
      },
    });

    const { unmount } = render(createElement(CommercialPlanner));
    preencher("Clínica Aurora", /nome do cliente/i);
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    preencher("Limpeza de pele", /procedimentos realizados/i);
    await waitFor(() => expect(dados.size).toBe(1));
    unmount();
    cleanup();

    // Recarregar a página é uma montagem nova do componente.
    render(createElement(CommercialPlanner));
    expect(await screen.findByRole("status")).toHaveTextContent("Retomamos o preenchimento");
    expect(screen.getByLabelText(/procedimentos realizados/i)).toHaveValue("Limpeza de pele");

    fireEvent.click(screen.getByRole("button", { name: /recomeçar do zero/i }));

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByLabelText(/nome do cliente/i)).toHaveValue("");
    expect(dados.has(DRAFT_KEY)).toBe(false);
  });
});
