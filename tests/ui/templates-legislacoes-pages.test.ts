// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Templates from "@/app/(internal)/templates/page";
import Legislacoes from "@/app/(internal)/legislacoes/page";

/**
 * Páginas administrativas de templates e legislações (PV-011): cobre CRUD,
 * importação em lote, duplicação, restauração de versão, filtros e as falhas
 * de arquivo/API/validação que cada fluxo pode encontrar. O bloqueio de
 * operador nessas rotas já é coberto em tests/auth/middleware.test.ts e
 * tests/auth/authorization.test.ts — aqui o alvo é o comportamento da UI.
 */

const TEMPLATE_A = {
  id: "t1",
  nome: "MBP Clínica Aurora",
  tipo: "MBP",
  padraoHeader: "A",
  processingType: "SONNET_REQUIRED",
  ativo: true,
  criadoEm: "2026-08-10T12:00:00.000Z",
};

const TEMPLATE_B = {
  id: "t2",
  nome: "POP Micropigmentação",
  tipo: "POP",
  padraoHeader: "B",
  processingType: "LIGHT_HAIKU",
  ativo: false,
  criadoEm: "2026-08-11T12:00:00.000Z",
};

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

interface Rota {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  match: RegExp;
  status?: number;
  body: unknown;
}

/** Roteia por método + padrão de URL ancorado, para não confundir `/api/templates`
 * com `/api/templates/:id/variaveis` por serem o mesmo prefixo. */
function rotear(rotas: Rota[]) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = (init?.method || "GET").toUpperCase();
    const rota = rotas.find((r) => r.method === method && r.match.test(String(url)));
    if (!rota) return jsonResponse(200, {});
    return jsonResponse(rota.status ?? 200, rota.body);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("página de templates", () => {
  it("lista os templates cadastrados e mostra o tipo de processamento", async () => {
    rotear([{ method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A, TEMPLATE_B] }]);
    render(createElement(Templates));

    await screen.findByText("MBP Clínica Aurora");
    expect(screen.getByText("POP Micropigmentação")).toBeInTheDocument();
  });

  it("nomeia a origem quando o catálogo não carrega", async () => {
    rotear([{ method: "GET", match: /^\/api\/templates$/, status: 500, body: { error: "Falha no banco ao listar templates" } }]);
    render(createElement(Templates));

    expect(await screen.findByText(/Falha no banco ao listar templates/)).toBeInTheDocument();
  });

  it("filtra a lista por busca ignorando acento e caixa", async () => {
    rotear([{ method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A, TEMPLATE_B] }]);
    render(createElement(Templates));
    await screen.findByText("MBP Clínica Aurora");

    fireEvent.change(screen.getByLabelText("Buscar template"), { target: { value: "micropigmentacao" } });

    expect(screen.queryByText("MBP Clínica Aurora")).not.toBeInTheDocument();
    expect(screen.getByText("POP Micropigmentação")).toBeInTheDocument();
  });

  it("recusa enviar o formulário manual sem nome e arquivo, sem chamar a API", async () => {
    rotear([{ method: "GET", match: /^\/api\/templates$/, body: [] }]);
    render(createElement(Templates));
    await screen.findByText(/Nenhum template cadastrado/);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar template" }));

    expect(await screen.findByText("Nome e arquivo são obrigatórios.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/templates", expect.objectContaining({ method: "POST" }));
  });

  it("importa um lote e relata status por arquivo, inclusive erro", async () => {
    rotear([
      { method: "GET", match: /^\/api\/templates$/, body: [] },
      {
        method: "POST",
        match: /\/api\/templates\/bulk-import$/,
        body: { results: [{ nome: "POP Novo", status: "importado", tipo: "POP", variaveis: 3, errosValidacao: 0 }] },
      },
    ]);
    render(createElement(Templates));
    await screen.findByText(/Nenhum template cadastrado/);

    const arquivo = new File(["conteudo"], "POP Novo.docx", { type: "application/vnd.openxmlformats" });
    fireEvent.change(screen.getByLabelText("Selecionar arquivos DOCX para importação em lote"), { target: { files: [arquivo] } });
    fireEvent.click(screen.getByRole("button", { name: /Importar\/atualizar 1 template/ }));

    expect(await screen.findByText(/1 novo\(s\), 0 atualizado\(s\), 0 com erro/)).toBeInTheDocument();
    expect(screen.getByText("importado")).toBeInTheDocument();
  });

  it("duplica um template existente", async () => {
    rotear([
      { method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A] },
      { method: "POST", match: /\/duplicar$/, body: { ...TEMPLATE_A, id: "t1-copia", nome: "MBP Clínica Aurora (cópia)" } },
    ]);
    render(createElement(Templates));
    await screen.findByText("MBP Clínica Aurora");

    fireEvent.click(screen.getByTitle("Duplicar template"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/templates/t1/duplicar", expect.objectContaining({ method: "POST" }))
    );
  });

  it("pede confirmação nomeando o template antes de excluir", async () => {
    rotear([
      { method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A] },
      { method: "DELETE", match: /^\/api\/templates\/[^/]+$/, body: {} },
    ]);
    render(createElement(Templates));
    await screen.findByText("MBP Clínica Aurora");

    fireEvent.click(screen.getByTitle("Excluir template"));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("MBP Clínica Aurora")).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/templates/t1", expect.objectContaining({ method: "DELETE" }))
    );
  });

  it("seleciona vários templates e confirma a exclusão em lote pela contagem", async () => {
    rotear([
      { method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A, TEMPLATE_B] },
      { method: "DELETE", match: /^\/api\/templates\/[^/]+$/, body: {} },
    ]);
    render(createElement(Templates));
    await screen.findByText("MBP Clínica Aurora");

    fireEvent.click(screen.getByLabelText(`Selecionar ${TEMPLATE_A.nome}`));
    fireEvent.click(screen.getByLabelText(`Selecionar ${TEMPLATE_B.nome}`));

    fireEvent.click(screen.getByRole("button", { name: /Excluir 2/ }));

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Excluir 2 templates?");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/templates/t1", expect.objectContaining({ method: "DELETE" }))
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/templates/t2", expect.objectContaining({ method: "DELETE" }));
  });

  it("valida um template e mostra tags desconhecidas no diagnóstico", async () => {
    rotear([
      { method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A] },
      {
        method: "GET",
        match: /\/variaveis$/,
        body: {
          variaveis: ["cliente_nome_fantasia", "tag_inexistente"],
          variaveisReconhecidas: ["cliente_nome_fantasia"],
          variaveisDesconhecidas: ["tag_inexistente"],
          condicionais: [],
          blocosIa: 1,
          issues: [{ level: "error", message: "Tag desconhecida encontrada." }],
          valid: false,
        },
      },
    ]);
    render(createElement(Templates));
    await screen.findByText("MBP Clínica Aurora");

    fireEvent.click(screen.getByTitle("Validar variáveis do template"));

    expect(await screen.findByText("Tag desconhecida encontrada.")).toBeInTheDocument();
    expect(screen.getByText("{tag_inexistente}")).toBeInTheDocument();
  });

  it("abre o histórico e restaura uma versão anterior após confirmação", async () => {
    rotear([
      { method: "GET", match: /^\/api\/templates$/, body: [TEMPLATE_A] },
      {
        method: "GET",
        match: /\/versoes$/,
        body: [
          {
            id: "v1",
            nome: "MBP Clínica Aurora",
            tipo: "MBP",
            padraoHeader: "A",
            processingType: "LIGHT_HAIKU",
            arquivoPath: "x",
            motivo: "Importação em lote",
            criadaEm: "2026-08-01T10:00:00.000Z",
          },
        ],
      },
      { method: "POST", match: /\/restaurar$/, body: TEMPLATE_A },
    ]);
    render(createElement(Templates));
    await screen.findByText("MBP Clínica Aurora");

    fireEvent.click(screen.getByTitle("Ver e restaurar versões anteriores"));
    await screen.findByText("Versões do template");

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Restaurar esta versão?" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Restaurar versão" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/templates/t1/versoes/v1/restaurar", expect.objectContaining({ method: "POST" }))
    );
  });
});

describe("página de legislações", () => {
  const LEG_FEDERAL = {
    id: "l1",
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei Federal nº 1.000/2000",
    referenciaAbnt: "BRASIL. Lei nº 1.000, de 1º de janeiro de 2000...",
    destaqueAbnt: null,
    ativo: true,
  };

  const LEG_MUNICIPAL = {
    id: "l2",
    estadoUf: "RJ",
    municipio: "Rio de Janeiro",
    tipo: "municipal",
    titulo: "Decreto Municipal nº 500/2010",
    referenciaAbnt: "RIO DE JANEIRO. Decreto nº 500, de 2010...",
    destaqueAbnt: null,
    ativo: true,
  };

  it("lista legislações e filtra por esfera", async () => {
    rotear([{ method: "GET", match: /^\/api\/legislacoes$/, body: [LEG_FEDERAL, LEG_MUNICIPAL] }]);
    render(createElement(Legislacoes));

    await screen.findByText("Lei Federal nº 1.000/2000");
    expect(screen.getByText("Decreto Municipal nº 500/2010")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por esfera"), { target: { value: "municipal" } });

    expect(screen.queryByText("Lei Federal nº 1.000/2000")).not.toBeInTheDocument();
    expect(screen.getByText("Decreto Municipal nº 500/2010")).toBeInTheDocument();
  });

  it("bloqueia adicionar sem título e referência preenchidos", async () => {
    rotear([{ method: "GET", match: /^\/api\/legislacoes$/, body: [] }]);
    render(createElement(Legislacoes));
    await screen.findByText("Nenhuma legislação encontrada.");

    expect(screen.getByRole("button", { name: "Adicionar" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/legislacoes", expect.objectContaining({ method: "POST" }));
  });

  it("mostra o erro da API ao salvar uma referência nova", async () => {
    rotear([
      { method: "GET", match: /^\/api\/legislacoes$/, body: [] },
      { method: "POST", match: /^\/api\/legislacoes$/, status: 400, body: { error: "Referência ABNT inválida." } },
    ]);
    render(createElement(Legislacoes));
    await screen.findByText("Nenhuma legislação encontrada.");

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Lei de teste" } });
    fireEvent.change(screen.getByLabelText("Referência ABNT completa"), { target: { value: "Referência de teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("Referência ABNT inválida.")).toBeInTheDocument();
  });

  it("analisa um DOCX importado e adiciona as referências selecionadas", async () => {
    rotear([
      { method: "GET", match: /^\/api\/legislacoes$/, body: [] },
      {
        method: "POST",
        match: /\/api\/legislacoes\/importar$/,
        body: {
          referencias: [
            { estadoUf: "RJ", tipo: "estadual", titulo: "Nova Lei Estadual", referenciaAbnt: "RIO DE JANEIRO. Lei...", ativo: true },
          ],
          textoExtraidoPreview: "texto extraído",
        },
      },
      { method: "POST", match: /^\/api\/legislacoes$/, body: { id: "l3" } },
    ]);
    render(createElement(Legislacoes));
    await screen.findByText("Nenhuma legislação encontrada.");

    const arquivo = new File(["conteudo"], "documento.docx", { type: "application/vnd.openxmlformats" });
    fireEvent.change(screen.getByLabelText("Arquivo .docx"), { target: { files: [arquivo] } });
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));

    await screen.findByText("Nova Lei Estadual");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar selecionadas" }));

    expect(await screen.findByText(/1 referência\(s\) adicionada\(s\) à base/)).toBeInTheDocument();
  });

  it("avisa quando a análise do arquivo falha", async () => {
    rotear([
      { method: "GET", match: /^\/api\/legislacoes$/, body: [] },
      { method: "POST", match: /\/api\/legislacoes\/importar$/, status: 500, body: { error: "Não foi possível ler o DOCX enviado." } },
    ]);
    render(createElement(Legislacoes));
    await screen.findByText("Nenhuma legislação encontrada.");

    const arquivo = new File(["conteudo"], "documento.docx", { type: "application/vnd.openxmlformats" });
    fireEvent.change(screen.getByLabelText("Arquivo .docx"), { target: { files: [arquivo] } });
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));

    expect(await screen.findByText("Não foi possível ler o DOCX enviado.")).toBeInTheDocument();
  });

  it("pede confirmação nomeando a legislação antes de excluir", async () => {
    rotear([
      { method: "GET", match: /^\/api\/legislacoes$/, body: [LEG_FEDERAL] },
      { method: "DELETE", match: /^\/api\/legislacoes\/[^/]+$/, body: {} },
    ]);
    render(createElement(Legislacoes));
    await screen.findByText("Lei Federal nº 1.000/2000");

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("Lei Federal nº 1.000/2000")).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/legislacoes/l1", expect.objectContaining({ method: "DELETE" }))
    );
  });

  it("edita uma legislação existente", async () => {
    rotear([
      { method: "GET", match: /^\/api\/legislacoes$/, body: [LEG_FEDERAL] },
      { method: "PATCH", match: /^\/api\/legislacoes\/[^/]+$/, body: { ...LEG_FEDERAL, titulo: "Lei Federal nº 1.000/2000 (revisada)" } },
    ]);
    render(createElement(Legislacoes));
    await screen.findByText("Lei Federal nº 1.000/2000");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar legislação" });
    fireEvent.change(within(dialogo).getByLabelText("Título"), { target: { value: "Lei Federal nº 1.000/2000 (revisada)" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/legislacoes/l1", expect.objectContaining({ method: "PATCH" }))
    );
  });
});
