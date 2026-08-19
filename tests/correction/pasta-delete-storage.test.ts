import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

vi.mock("@/lib/auth/authorization", () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }));

import { DELETE } from "@/app/api/pastas/[id]/route";
import { DELETE as excluirEmLote } from "@/app/api/pastas/[id]/uploads-corrigidos/route";

/**
 * A mesma coisa que `pasta-delete.test.ts` afirma com mock, agora contra o
 * banco e o disco de verdade (PV-026).
 *
 * Os dois níveis existem de propósito. O mock prova a decisão — o que a rota
 * escolhe apagar e o que ela preserva. Este prova que a decisão chega ao disco:
 * caminho resolvido, área conferida, arquivo sumido. Foi a falta desta segunda
 * camada que deixou o defeito original passar por meses — o comentário dizia que
 * o `uploadPath` ficava, e nenhum teste contava quanto isso custava.
 */

const RAIZ_STORAGE = path.resolve(process.cwd(), "storage");
const QA = "QA-TORNEIRA";
const pastasCriadas: string[] = [];
const arquivosCriados: string[] = [];

function plantarArquivo(area: string, nome: string): string {
  const relativo = `storage/${area}/${nome}`;
  const absoluto = path.resolve(process.cwd(), relativo);
  fs.mkdirSync(path.dirname(absoluto), { recursive: true });
  fs.writeFileSync(absoluto, QA);
  arquivosCriados.push(absoluto);
  return relativo;
}

function existe(relativo: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativo));
}

afterAll(async () => {
  if (pastasCriadas.length > 0) {
    await prisma.pasta.deleteMany({ where: { id: { in: pastasCriadas } } });
  }
  arquivosCriados.forEach((absoluto) => {
    if (!absoluto.startsWith(RAIZ_STORAGE + path.sep)) return;
    if (fs.existsSync(absoluto)) fs.unlinkSync(absoluto);
  });
});

async function criarPasta(dados: Record<string, unknown> = {}) {
  const pasta = await prisma.pasta.create({
    data: { status: "rascunho", clienteNomeFantasia: `${QA} Clínica`, clienteEstado: "MG", ...dados },
  });
  pastasCriadas.push(pasta.id);
  return pasta;
}

describe("exclusão leva o arquivo junto, no disco", () => {
  it("apaga original, extração, saída e logo ao excluir a pasta", async () => {
    const forms = plantarArquivo("uploads", `${QA}-forms.pdf`);
    const elaboracao = plantarArquivo("uploads", `${QA}-elaboracao.docx`);
    const original = plantarArquivo("uploads", `${QA}-original.docx`);
    const corrigido = plantarArquivo("output", `${QA}-corrigido.docx`);
    const logo = plantarArquivo("logos", `${QA}-logo.png`);

    const pasta = await criarPasta({
      formsPdfPath: forms,
      documentosElaboracaoPath: elaboracao,
      clienteLogoPath: logo,
    });
    await prisma.documentoUpload.create({
      data: { pastaId: pasta.id, nomeArquivo: "original.docx", uploadPath: original, outputPath: corrigido },
    });

    const response = await DELETE(new NextRequest(`http://localhost/api/pastas/${pasta.id}`, { method: "DELETE" }), {
      params: { id: pasta.id },
    });

    expect(response.status).toBe(200);
    expect(await prisma.pasta.findUnique({ where: { id: pasta.id } })).toBeNull();
    expect([forms, elaboracao, original, corrigido, logo].filter(existe)).toEqual([]);
  });

  it("preserva a logo que outra pasta duplicada ainda usa", async () => {
    const logo = plantarArquivo("logos", `${QA}-logo-compartilhada.png`);
    const pasta = await criarPasta({ clienteLogoPath: logo });
    await criarPasta({ clienteLogoPath: logo });

    const response = await DELETE(new NextRequest(`http://localhost/api/pastas/${pasta.id}`, { method: "DELETE" }), {
      params: { id: pasta.id },
    });

    expect(response.status).toBe(200);
    expect(existe(logo)).toBe(true);
  });

  it("apaga o original na exclusão em lote e mantém o resto da pasta", async () => {
    const some = plantarArquivo("uploads", `${QA}-lote-sai.docx`);
    const fica = plantarArquivo("uploads", `${QA}-lote-fica.docx`);
    const pasta = await criarPasta();
    const alvo = await prisma.documentoUpload.create({
      data: { pastaId: pasta.id, nomeArquivo: "sai.docx", uploadPath: some },
    });
    await prisma.documentoUpload.create({
      data: { pastaId: pasta.id, nomeArquivo: "fica.docx", uploadPath: fica },
    });

    const response = await excluirEmLote(
      new NextRequest(`http://localhost/api/pastas/${pasta.id}/uploads-corrigidos`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [alvo.id] }),
      }),
      { params: { id: pasta.id } }
    );

    expect(response.status).toBe(200);
    expect(existe(some)).toBe(false);
    expect(existe(fica)).toBe(true);
    expect(await prisma.documentoUpload.count({ where: { pastaId: pasta.id } })).toBe(1);
  });
});
