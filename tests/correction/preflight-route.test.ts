import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashDocx } from "@/lib/docx-replacement-plan";
import { montarDocx, paragrafo, run } from "./docx-fixture";

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

import { POST as preflight } from "@/app/api/pastas/[id]/uploads-corrigidos/preflight/route";
import { POST as aplicar } from "@/app/api/pastas/[id]/uploads-corrigidos/aplicar/route";

const PARAMS = { params: { id: "pasta-a" } };

function pedido(rota: "preflight" | "aplicar", body: unknown) {
  return new NextRequest(`http://localhost/api/pastas/pasta-a/uploads-corrigidos/${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DOCX = montarDocx({ corpo: paragrafo(run("Clinica Antiga Ltda")) });
const PAR = [{ de: "Clinica Antiga", para: "Clinica Nova" }];

function documento(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-a",
    nomeArquivo: "MBP.docx",
    uploadPath: "storage/uploads/mbp.docx",
    outputPath: null,
    versoes: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readStorageBuffer.mockResolvedValue(DOCX);
  mocks.saveGeneratedDocx.mockResolvedValue("storage/output/pasta-a/corrigido.docx");
  mocks.transaction.mockResolvedValue([]);
  mocks.update.mockResolvedValue({});
});

describe("preflight de correção", () => {
  it("recusa pedido sem documento", async () => {
    const resposta = await preflight(pedido("preflight", { substituicoes: PAR }), PARAMS);

    expect(resposta.status).toBe(400);
    expect(mocks.readStorageBuffer).not.toHaveBeenCalled();
  });

  it("recusa pedido sem par de substituição utilizável", async () => {
    const resposta = await preflight(
      pedido("preflight", { docId: "doc-a", substituicoes: [{ de: "   ", para: "x" }] }),
      PARAMS
    );

    expect(resposta.status).toBe(400);
    expect(mocks.readStorageBuffer).not.toHaveBeenCalled();
  });

  it("não analisa documento de outra pasta", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const resposta = await preflight(
      pedido("preflight", { docId: "doc-a", substituicoes: PAR }),
      PARAMS
    );

    expect(resposta.status).toBe(404);
    expect(mocks.readStorageBuffer).not.toHaveBeenCalled();
  });

  it("devolve contagem, contexto e hash sem alterar o documento", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await preflight(
      pedido("preflight", { docId: "doc-a", substituicoes: PAR }),
      PARAMS
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.hashOrigem).toBe(hashDocx(DOCX));
    expect(corpo.totalOcorrencias).toBe(1);
    expect(corpo.substituicoes[0]).toMatchObject({ total: 1, corpo: 1 });
    expect(corpo.baseCorrigida).toBe(false);
    // Analisar é somente leitura: nada é gravado nem no banco nem no Storage.
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.saveGeneratedDocx).not.toHaveBeenCalled();
  });

  it("avisa quando a base já é uma correção anterior", async () => {
    mocks.findFirst.mockResolvedValue(documento({ outputPath: "storage/output/v1.docx" }));

    const resposta = await preflight(
      pedido("preflight", { docId: "doc-a", substituicoes: PAR }),
      PARAMS
    );

    expect((await resposta.json()).baseCorrigida).toBe(true);
    expect(mocks.readStorageBuffer).toHaveBeenCalledWith("storage/output/v1.docx");
  });

  it("nomeia a dependência quando o arquivo não pode ser lido", async () => {
    mocks.findFirst.mockResolvedValue(documento());
    mocks.readStorageBuffer.mockRejectedValue(new Error("arquivo ausente no Storage"));

    const resposta = await preflight(
      pedido("preflight", { docId: "doc-a", substituicoes: PAR }),
      PARAMS
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(422);
    expect(corpo.error).toContain("MBP.docx");
    expect(corpo.error).toContain("arquivo ausente no Storage");
  });
});

describe("trava de hash na aplicação", () => {
  it("recusa com 409 quando a base mudou desde a análise", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await aplicar(
      pedido("aplicar", { docId: "doc-a", substituicoes: PAR, hashOrigem: "hash-de-outra-versao" }),
      PARAMS
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(409);
    expect(corpo.hashOrigem).toBe(hashDocx(DOCX));
    // A recusa não pode deixar o registro em estado intermediário.
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("aplica quando o hash confere e devolve a contagem do que mudou", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await aplicar(
      pedido("aplicar", { docId: "doc-a", substituicoes: PAR, hashOrigem: hashDocx(DOCX) }),
      PARAMS
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.status).toBe("processado");
    expect(corpo.contagens).toEqual([
      { de: "Clinica Antiga", total: 1, corpo: 1, cabecalho: 0, rodape: 0 },
    ]);
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("aplica sem hash, preservando o cliente que ainda não analisa antes", async () => {
    mocks.findFirst.mockResolvedValue(documento());

    const resposta = await aplicar(pedido("aplicar", { docId: "doc-a", substituicoes: PAR }), PARAMS);

    expect((await resposta.json()).status).toBe("processado");
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("marca erro e nomeia a dependência quando a base não pode ser lida", async () => {
    mocks.findFirst.mockResolvedValue(documento());
    mocks.readStorageBuffer.mockRejectedValue(new Error("arquivo ausente no Storage"));

    const resposta = await aplicar(pedido("aplicar", { docId: "doc-a", substituicoes: PAR }), PARAMS);
    const corpo = await resposta.json();

    expect(corpo.status).toBe("erro");
    expect(corpo.erro).toContain("arquivo ausente no Storage");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "doc-a" },
      data: { status: "erro", mensagemErro: "arquivo ausente no Storage" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
