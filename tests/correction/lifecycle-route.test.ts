import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { POST as receber } from "@/app/api/pastas/[id]/uploads-corrigidos/route";
import { POST as analisar } from "@/app/api/pastas/[id]/uploads-corrigidos/preflight/route";
import { POST as aplicar } from "@/app/api/pastas/[id]/uploads-corrigidos/aplicar/route";
import { GET as prever } from "@/app/api/pastas/[id]/uploads-corrigidos/[uploadId]/preview/route";
import { GET as baixar } from "@/app/api/pastas/[id]/uploads-corrigidos/[uploadId]/download/route";
import { POST as restaurar } from "@/app/api/pastas/[id]/uploads-corrigidos/[uploadId]/restaurar/route";
import { montarDocx, paragrafo, run } from "./docx-fixture";

/**
 * O contrato da correção, exercido contra o banco e o storage locais (PV-012).
 *
 * A suíte E2E cobre este mesmo caminho pela rede, mas só roda com conta QA — e
 * conta QA não existe em máquina de desenvolvimento. Este teste é o que garante
 * que o contrato continua de pé em toda execução de `npm run test:run`: se um
 * campo de resposta mudar de nome, quebra aqui, e não na véspera da homologação.
 *
 * Fica fora do escopo daqui o que depende de sessão — papel, 401 e 403 —, que é
 * do middleware e está em `tests/auth`.
 */

const QA = "QA-VITEST";
const ANTIGO = "NOME ANTIGO DA CLINICA";
const NOVO = `${QA} NOME NOVO`;
const SUBSTITUICOES = [{ de: ANTIGO, para: NOVO }];

let pastaId = "";
let uploadId = "";
const arquivosCriados: string[] = [];

const RAIZ_STORAGE = path.resolve(process.cwd(), "storage");

/** Só remove o que estiver comprovadamente dentro de `storage/`. */
function apagarDoStorage(relativo: string, recursivo = false): void {
  const absoluto = path.resolve(RAIZ_STORAGE, relativo);
  if (!absoluto.startsWith(RAIZ_STORAGE + path.sep)) return;
  if (fs.existsSync(absoluto)) fs.rmSync(absoluto, { recursive: recursivo, force: true });
}

function url(caminho: string): string {
  return `http://localhost/api/pastas${caminho}`;
}

function jsonRequest(caminho: string, body: unknown): NextRequest {
  return new NextRequest(url(caminho), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const pasta = await prisma.pasta.create({
    data: { status: "rascunho", clienteNomeFantasia: `${QA} Clínica`, clienteEstado: "MG" },
  });
  pastaId = pasta.id;
});

afterAll(async () => {
  // Nada de QA sobrevive à execução, nem no banco nem no storage. A pasta de
  // saída vai inteira: restaurar cria versões cujo caminho o teste não conhece,
  // e foi assim que a primeira execução deixou arquivo para trás.
  if (pastaId) await prisma.pasta.deleteMany({ where: { id: pastaId } });
  arquivosCriados.forEach((arquivo) => apagarDoStorage(arquivo));
  if (pastaId) apagarDoStorage(path.join("output", pastaId), true);
});

describe("ciclo de correção de um documento enviado", () => {
  it("recebe o documento e o registra como pendente", async () => {
    const formData = new FormData();
    formData.append(
      "arquivos",
      new File([new Uint8Array(montarDocx({ corpo: paragrafo(run(ANTIGO)), header1: paragrafo(run(ANTIGO)) }))], `${QA}.docx`, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );

    const resposta = await receber(
      new NextRequest(url(`/${pastaId}/uploads-corrigidos`), { method: "POST", body: formData }),
      { params: { id: pastaId } }
    );

    expect(resposta.status).toBe(201);
    const criados = await resposta.json();
    expect(Array.isArray(criados)).toBe(true);
    expect(criados[0].status).toBe("pendente");
    uploadId = criados[0].id;
    arquivosCriados.push(criados[0].uploadPath);
  });

  it("a análise conta as ocorrências e devolve o hash da base", async () => {
    const resposta = await analisar(
      jsonRequest(`/${pastaId}/uploads-corrigidos/preflight`, { docId: uploadId, substituicoes: SUBSTITUICOES }),
      { params: { id: pastaId } }
    );

    expect(resposta.status).toBe(200);
    const plano = await resposta.json();
    // É este hash que a aplicação reenvia para travar com 409 caso o arquivo
    // tenha mudado entre analisar e confirmar.
    expect(plano.hashOrigem).toMatch(/^[0-9a-f]{16,}$/i);
    expect(plano.baseCorrigida).toBe(false);
    expect(plano.naoEncontradas).toEqual([]);
    // Corpo e cabeçalho: a correção alcança as duas partes, e é a soma delas que
    // o operador vê antes de confirmar.
    expect(plano.totalOcorrencias).toBe(2);
    expect(plano.substituicoes[0]).toMatchObject({ de: ANTIGO, corpo: 1, cabecalho: 1 });
  });

  it("recusa a aplicação quando o hash não corresponde à base", async () => {
    const resposta = await aplicar(
      jsonRequest(`/${pastaId}/uploads-corrigidos/aplicar`, {
        docId: uploadId,
        substituicoes: SUBSTITUICOES,
        hashOrigem: "0".repeat(64),
      }),
      { params: { id: pastaId } }
    );

    expect(resposta.status).toBe(409);
  });

  it("aplica, e a prévia passa a mostrar o texto novo", async () => {
    const analise = await analisar(
      jsonRequest(`/${pastaId}/uploads-corrigidos/preflight`, { docId: uploadId, substituicoes: SUBSTITUICOES }),
      { params: { id: pastaId } }
    );
    const { hashOrigem } = await analise.json();

    const resposta = await aplicar(
      jsonRequest(`/${pastaId}/uploads-corrigidos/aplicar`, {
        docId: uploadId,
        substituicoes: SUBSTITUICOES,
        hashOrigem,
      }),
      { params: { id: pastaId } }
    );

    expect(resposta.status).toBe(200);
    const resultado = await resposta.json();
    expect(resultado.erro).toBeUndefined();
    expect(resultado.status).toBe("processado");
    expect(resultado.aplicadas).toContain(ANTIGO);

    const doc = await prisma.documentoUpload.findUniqueOrThrow({ where: { id: uploadId } });
    if (doc.outputPath) arquivosCriados.push(doc.outputPath);

    const previa = await prever(new NextRequest(url("/x")), {
      params: { id: pastaId, uploadId },
    });
    expect(previa.status).toBe(200);
    expect((await previa.json()).html).toContain(NOVO);
  });

  it("o download entrega um .docx íntegro", async () => {
    const resposta = await baixar(new NextRequest(url("/x")), { params: { id: pastaId, uploadId } });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("wordprocessingml.document");
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    const corpo = Buffer.from(await resposta.arrayBuffer());
    // `PK` é a assinatura do zip; sem ela o Word recusa o arquivo.
    expect(corpo.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("restaurar o original devolve o texto anterior", async () => {
    const resposta = await restaurar(
      jsonRequest(`/${pastaId}/uploads-corrigidos/${uploadId}/restaurar`, { alvo: "original" }),
      { params: { id: pastaId, uploadId } }
    );

    expect(resposta.status).toBe(200);

    const previa = await prever(new NextRequest(url("/x")), { params: { id: pastaId, uploadId } });
    const html = (await previa.json()).html;
    expect(html).toContain(ANTIGO);
    expect(html).not.toContain(NOVO);
  });
});
