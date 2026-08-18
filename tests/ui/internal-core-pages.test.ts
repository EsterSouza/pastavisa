// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Dashboard from "@/app/(internal)/page";
import NovaPasta from "@/app/(internal)/pasta/nova/page";
import PastaDetalhe from "@/app/(internal)/pasta/[id]/page";
import EditarPasta from "@/app/(internal)/pasta/[id]/editar/page";
import ProcessarPasta from "@/app/(internal)/pasta/[id]/processar/page";
import CorrigirLotePasta from "@/app/(internal)/pasta/[id]/corrigir-lote/page";
import {
  describeErrorOrigin,
  DOCUMENTO_STATUS,
  PASTA_STATUS,
  UPLOAD_STATUS,
} from "@/components/ui/Status";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/pasta/p1",
}));

/**
 * Páginas internas principais: dashboard, nova pasta, detalhe, edição, geração e
 * correção. Usa `createElement` porque os arquivos de teste são `.ts` e não passam
 * por transformação de JSX; os componentes `.tsx` passam.
 */

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

const PAGINAS_INTERNAS = [
  "app/(internal)/page.tsx",
  "app/(internal)/pasta/nova/page.tsx",
  "app/(internal)/pasta/[id]/page.tsx",
  "app/(internal)/pasta/[id]/editar/page.tsx",
  "app/(internal)/pasta/[id]/processar/page.tsx",
  "app/(internal)/pasta/[id]/corrigir-lote/page.tsx",
];

const PASTAS = [
  {
    id: "p1",
    status: "concluida",
    criadaEm: "2026-08-10T12:00:00.000Z",
    clienteNomeFantasia: "Clínica Aurora",
    clienteEstado: "PA",
    documentos: [{ id: "d1", status: "gerado" }],
  },
  {
    id: "p2",
    status: "rascunho",
    criadaEm: "2026-08-15T12:00:00.000Z",
    clienteNomeFantasia: "Estética Bela Vida",
    clienteEstado: "SP",
    documentos: [],
  },
];

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => PASTAS });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderDashboard() {
  render(createElement(Dashboard));
  await screen.findByText("Clínica Aurora");
}

describe("dashboard de pastas", () => {
  it("lista as pastas com as mais recentes primeiro", async () => {
    await renderDashboard();

    const nomes = screen.getAllByRole("link").map((link) => link.textContent);
    const bela = nomes.findIndex((nome) => nome?.includes("Estética Bela Vida"));
    const aurora = nomes.findIndex((nome) => nome?.includes("Clínica Aurora"));

    // p2 foi criada depois de p1.
    expect(bela).toBeLessThan(aurora);
    expect(screen.getByRole("heading", { name: "Recentes" })).toBeInTheDocument();
  });

  it("filtra por busca ignorando acento e caixa", async () => {
    await renderDashboard();

    fireEvent.change(screen.getByLabelText(/buscar pasta/i), { target: { value: "estetica" } });

    expect(screen.queryByText("Clínica Aurora")).not.toBeInTheDocument();
    expect(screen.getByText("Estética Bela Vida")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
  });

  it("filtra por status e mostra a contagem de cada um", async () => {
    await renderDashboard();

    const concluidas = screen.getByRole("button", { name: /concluída: 1 pasta/i });
    expect(concluidas).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(concluidas);

    expect(concluidas).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Clínica Aurora")).toBeInTheDocument();
    expect(screen.queryByText("Estética Bela Vida")).not.toBeInTheDocument();
  });

  it("oferece saída quando o filtro não devolve nada", async () => {
    await renderDashboard();

    fireEvent.change(screen.getByLabelText(/buscar pasta/i), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhuma pasta encontrada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(screen.getByText("Clínica Aurora")).toBeInTheDocument();
  });

  it("mostra o estado vazio com o caminho para criar a primeira pasta", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    render(createElement(Dashboard));

    await screen.findByText("Nenhuma pasta criada ainda");
    expect(screen.getByRole("link", { name: /criar primeira pasta/i })).toHaveAttribute(
      "href",
      "/pasta/nova"
    );
  });

  it("nomeia a origem quando o banco não responde, em vez de carregar para sempre", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(createElement(Dashboard));

    const aviso = await screen.findByText(/Falha no banco/i);
    expect(aviso).toBeInTheDocument();
    expect(screen.queryByText("Carregando pastas...")).not.toBeInTheDocument();
  });

  it("pede confirmação antes de excluir, com foco preso no diálogo", async () => {
    await renderDashboard();

    fireEvent.click(screen.getAllByRole("button", { name: /excluir/i })[0]);

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleName("Excluir pasta?");
    // O foco entra no caminho seguro.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("origem nomeada dos erros", () => {
  it("aponta o subsistema em vez de dizer só que falhou", () => {
    const casos: Array<[string, string]> = [
      ['Nao foi possivel carregar o template de "POP.docx".', "template"],
      ["Dados salvos, mas a logo não foi gravada.", "logo"],
      ["Erro no upload de MBP.docx: conexão perdida.", "upload"],
      ["O memorial não confirmou persistência no banco.", "banco"],
      ["Tempo excedido na geração deste documento.", "geracao"],
    ];

    for (const [mensagem, origem] of casos) {
      expect(describeErrorOrigin(mensagem).origem).toBe(origem);
    }

    expect(describeErrorOrigin("A geração falhou no servidor (HTTP 500).").rotulo).toBe(
      "Falha na geração"
    );
  });
});

describe("estados nunca dependem só de cor", () => {
  it("todo status tem rótulo em texto", () => {
    for (const mapa of [PASTA_STATUS, DOCUMENTO_STATUS, UPLOAD_STATUS]) {
      for (const info of Object.values(mapa)) {
        expect(info.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("as seis páginas internas usam o mesmo kit de UI", () => {
  it("reaproveita os componentes de marca em vez de estilo solto", () => {
    for (const pagina of PAGINAS_INTERNAS) {
      expect(read(pagina)).toContain("@/components/ui/");
    }
  });

  it("não usa paletas fora do tailwind.config, que saíam sem cor nenhuma", () => {
    // slate, emerald e purple nunca existiram na configuração: as classes eram
    // escritas mas não pintavam nada.
    for (const pagina of PAGINAS_INTERNAS) {
      expect(read(pagina)).not.toMatch(/\b(?:bg|text|border)-(?:slate|emerald|purple|indigo)-/);
    }
  });

  it("mantém as rotas e ações do fluxo em cada página", () => {
    const detalhe = read("app/(internal)/pasta/[id]/page.tsx");
    for (const rota of ["/editar", "/processar", "/corrigir-lote", "/duplicar", "/download"]) {
      expect(detalhe).toContain(rota);
    }

    const processar = read("app/(internal)/pasta/[id]/processar/page.tsx");
    for (const acao of ["auto-template", "/api/gerar", "legislacoes/associar", "equipamentosSelecionados"]) {
      expect(processar).toContain(acao);
    }

    const corrigir = read("app/(internal)/pasta/[id]/corrigir-lote/page.tsx");
    for (const acao of ["preflight", "aplicar", "restaurar", "hashOrigem"]) {
      expect(corrigir).toContain(acao);
    }
  });
});

// --- Demais páginas do fluxo ------------------------------------------------

const PASTA_COMPLETA = {
  id: "p1",
  status: "rascunho",
  criadaEm: "2026-08-15T12:00:00.000Z",
  clienteNomeFantasia: "Clínica Aurora",
  clienteRazaoSocial: "Aurora Serviços de Saúde Ltda",
  clienteCnpj: "12.345.678/0001-90",
  clienteEstado: "PA",
  clienteCidade: "Belém",
  clienteRtNome: "",
  clienteEquipamentos: JSON.stringify([]),
  clienteProdutosInsumos: JSON.stringify([]),
  legislacaoIds: JSON.stringify([]),
  documentos: [
    {
      id: "d1",
      nomeArquivo: "POP - Limpeza de pele.docx",
      status: "erro",
      tokensUsados: null,
      mensagemErro: 'Nao foi possivel carregar o template de "POP - Limpeza de pele.docx".',
      templateId: "t1",
      outputPath: null,
      avisoRtNoCorpo: false,
      logoSubstituida: false,
      versoes: [],
    },
  ],
};

/** Devolve o payload da primeira chave que casa com a URL pedida. */
function rotearFetch(rotas: Array<[string, unknown]>) {
  fetchMock.mockImplementation(async (url: string) => {
    const rota = rotas.find(([chave]) => String(url).includes(chave));
    const corpo = rota ? rota[1] : {};
    return {
      ok: true,
      status: 200,
      json: async () => corpo,
      text: async () => JSON.stringify(corpo),
    };
  });
}

describe("detalhe da pasta", () => {
  it("mostra resumo, pendências acionáveis e o erro com a origem nomeada", async () => {
    rotearFetch([["/api/pastas/p1", PASTA_COMPLETA]]);
    render(createElement(PastaDetalhe));

    await screen.findByRole("heading", { name: "Clínica Aurora", level: 1 });

    // Resumo
    expect(screen.getByText("Belém / PA")).toBeInTheDocument();
    expect(screen.getByText("0 de 1")).toBeInTheDocument();

    // Pendências nomeiam o que falta e levam para onde resolver.
    expect(screen.getByText(/Dados do cliente faltando: responsável técnico/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /completar cadastro/i })).toHaveAttribute(
      "href",
      "/pasta/p1/editar"
    );
    expect(screen.getByText(/1 documento\(s\) terminaram com erro/i)).toBeInTheDocument();

    // O erro do documento diz qual subsistema falhou.
    expect(screen.getByText("Falha no template")).toBeInTheDocument();
  });

  it("não fica carregando para sempre quando o banco falha", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(createElement(PastaDetalhe));

    expect(await screen.findByText(/Falha no banco/i)).toBeInTheDocument();
  });
});

describe("edição do cadastro", () => {
  it("agrupa o formulário em seções e liga cada rótulo ao seu campo", async () => {
    rotearFetch([["/api/pastas/p1", PASTA_COMPLETA]]);
    render(createElement(EditarPasta));

    await screen.findByRole("heading", { name: "Estabelecimento" });

    for (const secao of [
      "Estabelecimento",
      "Responsável técnico",
      "Estrutura física",
      "Serviços",
      "Equipamentos",
      "Logo do cliente",
    ]) {
      expect(screen.getByRole("heading", { name: secao })).toBeInTheDocument();
    }

    // O rótulo solto do formulário antigo não focava nem anunciava o campo.
    const nomeFantasia = screen.getByLabelText("Nome fantasia");
    expect(nomeFantasia).toHaveValue("Clínica Aurora");
    fireEvent.change(nomeFantasia, { target: { value: "Clínica Aurora II" } });
    expect(screen.getByLabelText("Nome fantasia")).toHaveValue("Clínica Aurora II");
  });
});

describe("geração de documentos", () => {
  it("mostra status, template e bloqueio de cada documento", async () => {
    rotearFetch([
      ["/api/pastas/p1/documentos", PASTA_COMPLETA.documentos],
      ["/api/legislacoes", []],
      ["/api/templates", [{ id: "t1", nome: "POP padrão", tipo: "POP" }]],
      ["/api/pastas/p1", PASTA_COMPLETA],
    ]);
    render(createElement(ProcessarPasta));

    await screen.findByText("POP - Limpeza de pele.docx");

    expect(screen.getByRole("heading", { name: "Gerar documentos", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Template de POP - Limpeza de pele/i)).toBeInTheDocument();
    expect(screen.getByText("Falha no template")).toBeInTheDocument();
    expect(screen.getAllByText("Erro").length).toBeGreaterThan(0);
  });

  it("avisa quando uma lista vem com erro, em vez de quebrar calada", async () => {
    // O servidor responde `{ error }` em 401/500: antes o `.filter` estourava um
    // TypeError no console e a página ficava pela metade, sem dizer nada.
    rotearFetch([
      ["/api/pastas/p1/documentos", PASTA_COMPLETA.documentos],
      ["/api/legislacoes", []],
      ["/api/templates", { error: "Authentication required" }],
      ["/api/pastas/p1", PASTA_COMPLETA],
    ]);
    render(createElement(ProcessarPasta));

    expect(await screen.findByText(/catálogo de templates/i)).toBeInTheDocument();
    expect(screen.getAllByText("Falha no template").length).toBeGreaterThan(0);
  });

  it("acomoda titulo de legislacao com URL longa e da alvo de 44px ao checkbox", async () => {
    // Dado real: a citacao ABNT traz a URL do diario oficial num unico token de
    // centenas de caracteres, que empurrava a pagina em 600px no desktop.
    const urlLonga = `https://app.exemplo.gov.br/Manager/texto/arquivo/exibir/arquivo?${"e".repeat(200)}`;
    rotearFetch([
      ["/api/pastas/p1/documentos", PASTA_COMPLETA.documentos],
      [
        "/api/legislacoes",
        [
          {
            id: "l1",
            titulo: `PARÁ. Lei nº 5.199, de 10 de dezembro de 1984. Disponível em: ${urlLonga}`,
            tipo: "Lei",
            estadoUf: "PA",
            municipio: null,
          },
        ],
      ],
      ["/api/templates", [{ id: "t1", nome: "POP padrão", tipo: "POP" }]],
      ["/api/pastas/p1", PASTA_COMPLETA],
    ]);
    render(createElement(ProcessarPasta));

    expect(await screen.findByText(new RegExp(urlLonga.slice(0, 40)))).toBeInTheDocument();

    // O checkbox do documento fica dentro de um label com padding: sem ele o alvo
    // clicavel volta a ser a caixa nativa de 16px.
    const caixa = screen.getByLabelText("Selecionar POP - Limpeza de pele.docx");
    expect(caixa.closest("label")).not.toBeNull();
  });
});

describe("correção em lote", () => {
  it("apresenta as cinco etapas e explica por que aplicar está bloqueado", async () => {
    rotearFetch([["/uploads-corrigidos", []]]);
    render(createElement(CorrigirLotePasta));

    await screen.findByRole("heading", { name: "1. Enviar documentos finalizados" });

    for (const etapa of [
      "1. Enviar documentos finalizados",
      "2. Selecionar documentos",
      "3. Definir a rodada",
      "4. Revisar o que vai mudar",
      "5. Aplicar e baixar",
    ]) {
      expect(screen.getByRole("heading", { name: etapa })).toBeInTheDocument();
    }

    const aplicar = screen.getByRole("button", { name: /aplicar aos 0 selecionado/i });
    expect(aplicar).toBeDisabled();
    expect(screen.getByText("Selecione ao menos um documento na etapa 2.")).toBeInTheDocument();
  });
});

describe("nova pasta", () => {
  it("pede os dois arquivos em uma seção antes de liberar a análise", () => {
    render(createElement(NovaPasta));

    expect(screen.getByRole("heading", { name: "Nova Pasta Sanitária", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Arquivos do cliente" })).toBeInTheDocument();
    expect(screen.getByLabelText(/PDF do forms.app/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Documentos em Elaboração/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analisar necessidades/i })).toBeDisabled();
  });
});
