import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashDocx } from "@/lib/docx-replacement-plan";
import { montarDocx, paragrafo, run } from "./docx-fixture";

/**
 * Restaurar é o caminho de volta do fluxo de correção.
 *
 * Cada rodada parte de `outputPath || uploadPath`, isto é, da última saída: as
 * correções são cumulativas. Sem restaurar, um par aplicado por engano ficava
 * incorporado a todas as rodadas seguintes e o trabalho do cliente não tinha volta.
 *
 * O que estes testes fixam: restaurar acrescenta uma versão e nunca remove nenhuma,
 * o alvo é sempre explícito, e a base restaurada vence qualquer análise anterior —
 * a trava de 409 do aplicar passa a proteger justamente esse instante.
 */

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  criarVersao: vi.fn(),
  transaction: vi.fn(),
  readStorageBuffer: vi.fn(),
  saveGeneratedDocx: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentoUpload: { findFirst: mocks.findFirst, update: mocks.update },
    documentoUploadVersao: { create: mocks.criarVersao },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/file-storage", () => ({
  readStorageBuffer: mocks.readStorageBuffer,
  saveGeneratedDocx: mocks.saveGeneratedDocx,
}));

vi.mock("@/lib/generator", () => ({
  createOutputDocxFileName: (nome: string) => nome,
}));

import { POST as restaurar } from "@/app/api/pastas/[id]/uploads-corrigidos/[uploadId]/restaurar/route";
import { POST as aplicar } from "@/app/api/pastas/[id]/uploads-corrigidos/aplicar/route";

const PARAMS = { params: { id: "pasta-a", uploadId: "doc-a" } };
const PARAMS_APLICAR = { params: { id: "pasta-a" } };

const DOCX_ORIGINAL = montarDocx({ corpo: paragrafo(run("Clinica Antiga Ltda")) });
const DOCX_V1 = montarDocx({ corpo: paragrafo(run("Clinica Errada Ltda")) });

function pedido(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function pedidoRestaurar(body: unknown) {
  return pedido("http://localhost/api/pastas/pasta-a/uploads-corrigidos/doc-a/restaurar", body);
}

function documento(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-a",
    nomeArquivo: "MBP.docx",
    uploadPath: "storage/uploads/mbp.docx",
    outputPath: "storage/output/pasta-a/v1.docx",
    versoes: [{ id: "ver-1", outputPath: "storage/output/pasta-a/v1.docx" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readStorageBuffer.mockResolvedValue(DOCX_ORIGINAL);
  mocks.saveGeneratedDocx.mockResolvedValue("storage/output/pasta-a/restaurado.docx");
  mocks.transaction.mockResolvedValue([]);
  mocks.update.mockResolvedValue({});
});

describe("alvo da restauração", () => {
  it("recusa pedido sem alvo, em vez de assumir um padrão", async () => {
    const resposta = await restaurar(pedidoRestaurar({}), PARAMS);

    expect(resposta.status).toBe(400);
    // O padrão silencioso descartaria todas as correções do documento por um bug
    // de interface que deixasse de enviar o campo.
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.saveGeneratedDocx).not.toHaveBeenCalled();
  });

  it("recusa alvo de versão sem informar qual versão", async () => {
    const resposta = await restaurar(pedidoRestaurar({ alvo: "versao" }), PARAMS);

    expect(resposta.status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("não restaura documento de outra pasta", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const resposta = await restaurar(pedidoRestaurar({ alvo: "original" }), PARAMS);

    expect(resposta.status).toBe(404);
    expect(mocks.saveGeneratedDocx).not.toHaveBeenCalled();
  });

  it("não restaura versão que não pertence ao documento", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await restaurar(
      pedidoRestaurar({ alvo: "versao", versaoId: "ver-de-outro-doc" }),
      PARAMS
    );

    expect(resposta.status).toBe(404);
    expect(mocks.saveGeneratedDocx).not.toHaveBeenCalled();
  });

  it("recusa restaurar o original quando o documento já está no original", async () => {
    mocks.findFirst.mockResolvedValue(documento({ outputPath: null, versoes: [] }));

    const resposta = await restaurar(pedidoRestaurar({ alvo: "original" }), PARAMS);

    expect(resposta.status).toBe(409);
    expect(mocks.saveGeneratedDocx).not.toHaveBeenCalled();
  });

  it("recusa restaurar a versão que já está vigente", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await restaurar(pedidoRestaurar({ alvo: "versao", versaoId: "ver-1" }), PARAMS);

    expect(resposta.status).toBe(409);
    expect(mocks.saveGeneratedDocx).not.toHaveBeenCalled();
  });

  it("nomeia a dependência quando a base não pode ser lida", async () => {
    mocks.findFirst.mockResolvedValue(documento());
    mocks.readStorageBuffer.mockRejectedValue(new Error("arquivo ausente no Storage"));

    const resposta = await restaurar(pedidoRestaurar({ alvo: "original" }), PARAMS);
    const corpo = await resposta.json();

    expect(resposta.status).toBe(422);
    expect(corpo.error).toContain("MBP.docx");
    expect(corpo.error).toContain("arquivo ausente no Storage");
    // Uma base ilegível não pode virar a saída vigente.
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("recusa base que não é um docx íntegro", async () => {
    mocks.findFirst.mockResolvedValue(documento());
    mocks.readStorageBuffer.mockResolvedValue(Buffer.from("isto nao e um docx"));

    const resposta = await restaurar(pedidoRestaurar({ alvo: "original" }), PARAMS);

    expect(resposta.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("restauração bem-sucedida", () => {
  it("volta ao original criando uma versão nova, sem apagar nenhuma", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await restaurar(pedidoRestaurar({ alvo: "original" }), PARAMS);
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.status).toBe("restaurado");
    expect(corpo.restauradoDe).toBe("original");
    expect(mocks.readStorageBuffer).toHaveBeenCalledWith("storage/uploads/mbp.docx");

    // Uma versão a mais, apontando para um arquivo novo: a saída que estava
    // vigente continua registrada e baixável.
    expect(mocks.criarVersao).toHaveBeenCalledWith({
      data: {
        documentoUploadId: "doc-a",
        outputPath: "storage/output/pasta-a/restaurado.docx",
        substituicoes: JSON.stringify({ restauradoDe: { original: true } }),
      },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "doc-a" },
      data: {
        status: "restaurado",
        outputPath: "storage/output/pasta-a/restaurado.docx",
        mensagemErro: null,
      },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("volta para uma versão intermediária escolhida", async () => {
    mocks.findFirst.mockResolvedValue(
      documento({
        outputPath: "storage/output/pasta-a/v2.docx",
        versoes: [
          { id: "ver-1", outputPath: "storage/output/pasta-a/v1.docx" },
          { id: "ver-2", outputPath: "storage/output/pasta-a/v2.docx" },
        ],
      })
    );

    const resposta = await restaurar(pedidoRestaurar({ alvo: "versao", versaoId: "ver-1" }), PARAMS);
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.restauradoDe).toBe("versao");
    expect(mocks.readStorageBuffer).toHaveBeenCalledWith("storage/output/pasta-a/v1.docx");
    expect(mocks.criarVersao).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          substituicoes: JSON.stringify({ restauradoDe: { versaoId: "ver-1" } }),
        }),
      })
    );
  });

  it("devolve o hash da base restaurada, que é o que vence a análise anterior", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await restaurar(pedidoRestaurar({ alvo: "original" }), PARAMS);

    expect((await resposta.json()).hashOrigem).toBe(hashDocx(DOCX_ORIGINAL));
  });
});

describe("restaurar e depois aplicar", () => {
  it("recusa com 409 a aplicação que ainda carrega o hash de antes da restauração", async () => {
    // O operador analisou a rodada sobre a saída v1, restaurou o documento para o
    // original e tentou aplicar sem analisar de novo. Os números revisados descrevem
    // um arquivo que não é mais a base.
    const hashAnalisado = hashDocx(DOCX_V1);
    mocks.findFirst.mockResolvedValue(documento());
    mocks.readStorageBuffer.mockResolvedValue(DOCX_ORIGINAL);

    const resposta = await aplicar(
      pedido("http://localhost/api/pastas/pasta-a/uploads-corrigidos/aplicar", {
        docId: "doc-a",
        substituicoes: [{ de: "Clinica Errada", para: "Clinica Nova" }],
        hashOrigem: hashAnalisado,
      }),
      PARAMS_APLICAR
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(409);
    expect(corpo.hashOrigem).toBe(hashDocx(DOCX_ORIGINAL));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
