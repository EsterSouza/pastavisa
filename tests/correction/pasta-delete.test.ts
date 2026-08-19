import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  deletePasta: vi.fn(),
  deleteGeneratedDocx: vi.fn(),
  deleteUploadedFile: vi.fn(),
  deleteLogoFile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pasta: {
      findUnique: mocks.findUnique,
      count: mocks.count,
      delete: mocks.deletePasta,
    },
  },
}));

vi.mock("@/lib/file-storage", () => ({
  deleteGeneratedDocx: mocks.deleteGeneratedDocx,
  deleteUploadedFile: mocks.deleteUploadedFile,
  deleteLogoFile: mocks.deleteLogoFile,
}));

vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));

import { DELETE } from "@/app/api/pastas/[id]/route";

/**
 * Excluir a pasta leva junto o que o cliente enviou (PV-026).
 *
 * Até 19/08 a remoção só alcançava `storage/output`: a saída sumia e o original
 * ficava no Storage sem nada apontando para ele. Eram 82,8 MB de pasta já
 * excluída, invisíveis na tela e impossíveis de baixar.
 *
 * A logo é o caso de exceção, e é o motivo de este teste existir separado: a
 * duplicação de pasta copia o `clienteLogoPath` em vez de gerar cópia no
 * Storage, então o mesmo arquivo pode ter mais de um dono.
 */

const PASTA = "pasta-a";

function request() {
  return new NextRequest(`http://localhost/api/pastas/${PASTA}`, { method: "DELETE" });
}

function pasta(extra: Record<string, unknown> = {}) {
  return {
    id: PASTA,
    clienteLogoPath: null,
    formsPdfPath: null,
    documentosElaboracaoPath: null,
    documentos: [],
    documentosUpload: [],
    ...extra,
  };
}

describe("exclusão de pasta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.deletePasta.mockResolvedValue({ id: PASTA });
  });

  it("leva junto o original enviado e os dois arquivos da extração", async () => {
    mocks.findUnique.mockResolvedValue(
      pasta({
        formsPdfPath: "storage/uploads/forms.pdf",
        documentosElaboracaoPath: "storage/uploads/elaboracao.docx",
        documentos: [
          { outputPath: "storage/output/gerado.docx", versoes: [{ outputPath: "storage/output/gerado-v1.docx" }] },
        ],
        documentosUpload: [
          { uploadPath: "storage/uploads/original.docx", outputPath: "storage/output/corrigido.docx", versoes: [] },
        ],
      })
    );

    const response = await DELETE(request(), { params: { id: PASTA } });

    expect(response.status).toBe(200);
    expect(mocks.deleteUploadedFile.mock.calls.map(([ref]) => ref).sort()).toEqual([
      "storage/uploads/elaboracao.docx",
      "storage/uploads/forms.pdf",
      "storage/uploads/original.docx",
    ]);
    expect(mocks.deleteGeneratedDocx).toHaveBeenCalledTimes(3);
    expect(mocks.deletePasta).toHaveBeenCalledWith({ where: { id: PASTA } });
  });

  it("não repete o mesmo original quando ele aparece duas vezes", async () => {
    mocks.findUnique.mockResolvedValue(
      pasta({
        formsPdfPath: "storage/uploads/mesmo.docx",
        documentosUpload: [
          { uploadPath: "storage/uploads/mesmo.docx", outputPath: null, versoes: [] },
          { uploadPath: "storage/uploads/mesmo.docx", outputPath: null, versoes: [] },
        ],
      })
    );

    await DELETE(request(), { params: { id: PASTA } });

    expect(mocks.deleteUploadedFile).toHaveBeenCalledTimes(1);
    expect(mocks.deleteUploadedFile).toHaveBeenCalledWith("storage/uploads/mesmo.docx");
  });

  it("apaga a logo quando nenhuma outra pasta aponta para ela", async () => {
    mocks.findUnique.mockResolvedValue(pasta({ clienteLogoPath: "storage/logos/cliente.png" }));
    mocks.count.mockResolvedValue(0);

    await DELETE(request(), { params: { id: PASTA } });

    expect(mocks.count).toHaveBeenCalledWith({
      where: { clienteLogoPath: "storage/logos/cliente.png", id: { not: PASTA } },
    });
    expect(mocks.deleteLogoFile).toHaveBeenCalledWith("storage/logos/cliente.png");
  });

  it("preserva a logo que outra pasta duplicada ainda usa", async () => {
    mocks.findUnique.mockResolvedValue(pasta({ clienteLogoPath: "storage/logos/cliente.png" }));
    mocks.count.mockResolvedValue(1);

    const response = await DELETE(request(), { params: { id: PASTA } });

    expect(response.status).toBe(200);
    expect(mocks.deleteLogoFile).not.toHaveBeenCalled();
    expect(mocks.deletePasta).toHaveBeenCalled();
  });

  it("mantém a pasta de pé quando o arquivo não pode ser removido", async () => {
    mocks.findUnique.mockResolvedValue(
      pasta({ documentosUpload: [{ uploadPath: "storage/uploads/original.docx", outputPath: null, versoes: [] }] })
    );
    mocks.deleteUploadedFile.mockRejectedValue(new Error("Storage fora do ar"));

    const response = await DELETE(request(), { params: { id: PASTA } });

    expect(response.status).toBe(500);
    expect(mocks.deletePasta).not.toHaveBeenCalled();
  });

  it("não consulta logo compartilhada quando a pasta não tem logo", async () => {
    mocks.findUnique.mockResolvedValue(pasta());

    await DELETE(request(), { params: { id: PASTA } });

    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.deleteLogoFile).not.toHaveBeenCalled();
  });

  it("responde 404 sem apagar arquivo nenhum quando a pasta não existe", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await DELETE(request(), { params: { id: PASTA } });

    expect(response.status).toBe(404);
    expect(mocks.deleteUploadedFile).not.toHaveBeenCalled();
    expect(mocks.deleteGeneratedDocx).not.toHaveBeenCalled();
    expect(mocks.deleteLogoFile).not.toHaveBeenCalled();
    expect(mocks.deletePasta).not.toHaveBeenCalled();
  });
});
