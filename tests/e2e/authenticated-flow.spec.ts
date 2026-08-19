import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";

import { montarDocx, paragrafo, run } from "../correction/docx-fixture";
import { ADMIN, BASE_URL, OPERADOR, QA_PREFIX, SKIP_MESSAGES, qaLabel } from "./environment";

/**
 * Papéis e ciclo de vida de uma pasta, contra a aplicação de verdade (PV-012).
 *
 * Roda pela API, e não pela tela, de propósito: o que precisa ser homologado aqui
 * é o contrato — quem pode o quê, e se um documento corrigido volta ao original.
 * Seletor de tela quebra a cada ajuste visual e transformaria a homologação numa
 * fonte de alarme falso.
 *
 * As contas QA entram por variável de ambiente e nunca ficam no repositório. Sem
 * elas, os blocos se anunciam como pulados em vez de passar em falso.
 */

// A prévia converte o corpo do documento, não o cabeçalho; por isso o texto de
// QA entra nos dois — é o corpo que prova a correção na tela, e o cabeçalho que
// prova que a substituição alcança as partes soltas do pacote.
const TEXTO_ANTIGO = "NOME ANTIGO DA CLINICA";
const TEXTO_NOVO = `${QA_PREFIX} NOME NOVO`;

async function entrar(conta: { email: string; password: string }): Promise<APIRequestContext> {
  const contexto = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const resposta = await contexto.post("/api/auth/login", { data: conta });
  expect(resposta.status(), "login da conta QA recusado").toBe(200);
  return contexto;
}

test.describe("papéis", () => {
  test.skip(!OPERADOR || !ADMIN, `${SKIP_MESSAGES.operador} ${SKIP_MESSAGES.admin}`);

  let operador: APIRequestContext;
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    operador = await entrar(OPERADOR!);
    admin = await entrar(ADMIN!);
  });

  test.afterAll(async () => {
    await operador?.dispose();
    await admin?.dispose();
  });

  test("o operador trabalha nas pastas e não alcança a administração", async () => {
    expect((await operador.get("/api/pastas")).status()).toBe(200);

    // `/api/templates` e `/api/legislacoes` mudam o que sai em todas as pastas.
    // Um operador que alcance esse acervo altera documento de cliente já entregue.
    for (const caminho of ["/api/templates", "/api/legislacoes"]) {
      expect((await operador.get(caminho)).status(), caminho).toBe(403);
    }
  });

  test("o admin alcança o acervo", async () => {
    for (const caminho of ["/api/pastas", "/api/templates", "/api/legislacoes"]) {
      expect((await admin.get(caminho)).status(), caminho).toBe(200);
    }
  });

  test("a exclusão de pasta continua sendo só do admin", async () => {
    // Id inexistente: o que se mede é a recusa por papel, que vem antes da busca.
    const recusa = await operador.delete("/api/pastas/pasta-inexistente-qa");
    expect(recusa.status()).toBe(403);
  });
});

test.describe("ciclo de vida de uma pasta QA", () => {
  test.skip(!ADMIN, SKIP_MESSAGES.admin);
  test.describe.configure({ mode: "serial" });

  let admin: APIRequestContext;
  let pastaId = "";
  let uploadId = "";

  test.beforeAll(async () => {
    admin = await entrar(ADMIN!);
  });

  test.afterAll(async () => {
    // Limpeza incondicional: se um passo do meio falhar, o material de QA não
    // pode ficar para trás no banco nem no Storage.
    if (admin && pastaId) {
      if (uploadId) await admin.delete(`/api/pastas/${pastaId}/uploads-corrigidos`, { data: { ids: [uploadId] } });
      await admin.delete(`/api/pastas/${pastaId}`);
    }
    await admin?.dispose();
  });

  test("cria a pasta de QA", async () => {
    const resposta = await admin.post("/api/extrair/confirmar", {
      data: {
        pdfPath: "",
        docxPath: "",
        data: { clienteNomeFantasia: qaLabel("Pasta"), clienteCidade: "Belo Horizonte", clienteEstado: "MG" },
        documentosSelecionados: [],
      },
    });

    expect(resposta.status()).toBe(200);
    pastaId = (await resposta.json()).pastaId;
    expect(pastaId).toBeTruthy();
  });

  test("recebe um documento para correção", async () => {
    const resposta = await admin.post(`/api/pastas/${pastaId}/uploads-corrigidos`, {
      multipart: {
        arquivos: {
          name: `${QA_PREFIX}-documento.docx`,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: montarDocx({
            corpo: paragrafo(run(TEXTO_ANTIGO)),
            header1: paragrafo(run(TEXTO_ANTIGO)),
          }),
        },
      },
    });

    expect(resposta.status()).toBe(201);
    const criados = await resposta.json();
    expect(Array.isArray(criados)).toBe(true);
    uploadId = criados[0].id;
    expect(criados[0].status).toBe("pendente");
  });

  test("a análise conta o que a correção faria, sem alterar o arquivo", async () => {
    const resposta = await admin.post(`/api/pastas/${pastaId}/uploads-corrigidos/preflight`, {
      data: {
        docId: uploadId,
        substituicoes: [{ de: TEXTO_ANTIGO, para: TEXTO_NOVO }],
      },
    });

    expect(resposta.status()).toBe(200);
    const plano = await resposta.json();
    // O `hashOrigem` é o que trava a aplicação se o arquivo mudar entre a análise
    // e a confirmação; sem ele a correção seria aplicada sobre outra base.
    expect(plano.hashOrigem).toMatch(/^[0-9a-f]{16,}$/i);
    expect(plano.baseCorrigida).toBe(false);
    expect(plano.naoEncontradas).toEqual([]);
    expect(plano.totalOcorrencias, "a análise não encontrou o texto no documento").toBeGreaterThan(0);
  });

  test("aplica, prevê, baixa e restaura o original", async () => {
    const analise = await admin.post(`/api/pastas/${pastaId}/uploads-corrigidos/preflight`, {
      data: {
        docId: uploadId,
        substituicoes: [{ de: TEXTO_ANTIGO, para: TEXTO_NOVO }],
      },
    });
    const { hashOrigem } = await analise.json();

    const aplicacao = await admin.post(`/api/pastas/${pastaId}/uploads-corrigidos/aplicar`, {
      data: {
        docId: uploadId,
        hashOrigem,
        substituicoes: [{ de: TEXTO_ANTIGO, para: TEXTO_NOVO }],
      },
    });
    expect(aplicacao.status()).toBe(200);
    const resultado = await aplicacao.json();
    expect(resultado.erro, resultado.erro).toBeUndefined();
    expect(resultado.status).toBe("processado");
    expect(resultado.aplicadas).toContain(TEXTO_ANTIGO);

    const previa = await admin.get(`/api/pastas/${pastaId}/uploads-corrigidos/${uploadId}/preview`);
    expect(previa.status()).toBe(200);
    expect((await previa.json()).html).toContain(TEXTO_NOVO);

    const baixado = await admin.get(`/api/pastas/${pastaId}/uploads-corrigidos/${uploadId}/download`);
    expect(baixado.status()).toBe(200);
    expect(baixado.headers()["content-type"]).toContain("wordprocessingml.document");
    const corpo = await baixado.body();
    // `PK` é a assinatura do zip: um .docx que não comece assim não abre no Word.
    expect(corpo.subarray(0, 2).toString("latin1")).toBe("PK");

    const restauracao = await admin.post(
      `/api/pastas/${pastaId}/uploads-corrigidos/${uploadId}/restaurar`,
      { data: { alvo: "original" } }
    );
    expect(restauracao.status()).toBe(200);

    const depois = await admin.get(`/api/pastas/${pastaId}/uploads-corrigidos/${uploadId}/preview`);
    const html = (await depois.json()).html;
    expect(html).toContain(TEXTO_ANTIGO);
    expect(html).not.toContain(TEXTO_NOVO);
  });

  test("a limpeza não deixa material de QA para trás", async () => {
    expect((await admin.delete(`/api/pastas/${pastaId}/uploads-corrigidos`, { data: { ids: [uploadId] } })).status()).toBe(200);
    expect((await admin.delete(`/api/pastas/${pastaId}`)).status()).toBe(200);

    expect((await admin.get(`/api/pastas/${pastaId}`)).status()).toBe(404);

    const pastas = await (await admin.get("/api/pastas")).json();
    const sobras = (pastas as Array<{ id: string; clienteNomeFantasia?: string }>).filter((pasta) =>
      pasta.clienteNomeFantasia?.startsWith(QA_PREFIX)
    );
    expect(sobras.map((pasta) => pasta.clienteNomeFantasia), "sobrou pasta de QA no banco").toEqual([]);

    // Já apagados: o `afterAll` não precisa repetir.
    pastaId = "";
    uploadId = "";
  });
});
