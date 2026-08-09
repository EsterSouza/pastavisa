import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  deleteGeneratedDocx: vi.fn(),
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
    mocks.findMany.mockResolvedValue([{ id: "doc-a", outputPath: null, versoes: [] }]);

    const response = await DELETE(request({ ids: ["doc-a", "doc-b"] }), { params: { id: "pasta-a" } });

    expect(response.status).toBe(404);
    expect(mocks.deleteGeneratedDocx).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("remove saídas sem duplicar caminhos e exclui todos os registros selecionados", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "doc-a", outputPath: "storage/output/a.docx", versoes: [{ outputPath: "storage/output/a-v1.docx" }] },
      { id: "doc-b", outputPath: "storage/output/b.docx", versoes: [{ outputPath: "storage/output/a-v1.docx" }] },
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
});
