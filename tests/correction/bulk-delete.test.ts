import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  deleteGeneratedDocx: vi.fn(),
  deleteUploadedFile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentoUpload: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock("@/lib/file-storage", () => ({
  deleteGeneratedDocx: mocks.deleteGeneratedDocx,
  deleteUploadedFile: mocks.deleteUploadedFile,
  saveStorageBuffer: vi.fn(),
  safeStorageFileName: (value: string) => value,
}));

vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));

import { DELETE } from "@/app/api/pastas/[id]/uploads-corrigidos/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/pastas/pasta-a/uploads-corrigidos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("exclusão de documentos em lote", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não remove nada quando algum documento não pertence à pasta", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "doc-a", uploadPath: "storage/uploads/a.docx", outputPath: null, versoes: [] },
    ]);

    const response = await DELETE(request({ ids: ["doc-a", "doc-b"] }), { params: { id: "pasta-a" } });

    expect(response.status).toBe(404);
    expect(mocks.deleteGeneratedDocx).not.toHaveBeenCalled();
    expect(mocks.deleteUploadedFile).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("remove saídas sem duplicar caminhos e exclui todos os registros selecionados", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "doc-a",
        uploadPath: "storage/uploads/a.docx",
        outputPath: "storage/output/a.docx",
        versoes: [{ outputPath: "storage/output/a-v1.docx" }],
      },
      {
        id: "doc-b",
        uploadPath: "storage/uploads/b.docx",
        outputPath: "storage/output/b.docx",
        versoes: [{ outputPath: "storage/output/a-v1.docx" }],
      },
    ]);
    mocks.deleteMany.mockResolvedValue({ count: 2 });

    const response = await DELETE(request({ ids: ["doc-a", "doc-b", "doc-a"] }), { params: { id: "pasta-a" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, removidos: 2 });
    expect(mocks.deleteGeneratedDocx).toHaveBeenCalledTimes(3);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["doc-a", "doc-b"] }, pastaId: "pasta-a" },
    });
  });

  // Até 19/08 o original enviado ficava para trás de propósito, e havia
  // comentário no código dizendo isso. Eram 95,4 MB de documento de cliente em
  // pasta viva, sem nada apontando para eles. O PV-026 inverteu a decisão.
  it("leva junto o original enviado, sem repetir caminho", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "doc-a", uploadPath: "storage/uploads/a.docx", outputPath: null, versoes: [] },
      { id: "doc-b", uploadPath: "storage/uploads/a.docx", outputPath: null, versoes: [] },
      { id: "doc-c", uploadPath: "storage/uploads/c.docx", outputPath: null, versoes: [] },
    ]);
    mocks.deleteMany.mockResolvedValue({ count: 3 });

    const response = await DELETE(request({ ids: ["doc-a", "doc-b", "doc-c"] }), {
      params: { id: "pasta-a" },
    });

    expect(response.status).toBe(200);
    expect(mocks.deleteUploadedFile.mock.calls.map(([ref]) => ref).sort()).toEqual([
      "storage/uploads/a.docx",
      "storage/uploads/c.docx",
    ]);
  });

  it("mantém o documento na lista quando o arquivo não pode ser removido", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "doc-a", uploadPath: "storage/uploads/a.docx", outputPath: null, versoes: [] },
    ]);
    mocks.deleteUploadedFile.mockRejectedValue(new Error("Storage fora do ar"));

    const response = await DELETE(request({ ids: ["doc-a"] }), { params: { id: "pasta-a" } });

    expect(response.status).toBe(500);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
