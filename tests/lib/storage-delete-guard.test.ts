import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteGeneratedDocx, deleteLogoFile, deleteUploadedFile } from "@/lib/file-storage";

/**
 * A trava de área da remoção (PV-026).
 *
 * Cada função só apaga dentro da sua pasta. A área é literal no código de quem
 * chama e nunca vem do pedido, então o que este teste protege é o outro caso:
 * referência estragada no banco, caminho forjado, `..` no meio. Nesses casos a
 * função tem de lançar — apagar fora da área é pior do que não apagar nada.
 *
 * Roda contra o disco de verdade, no driver local, porque a trava do caminho
 * local é uma comparação de string resolvida e é exatamente aí que ela falha
 * quando alguém mexe sem prestar atenção.
 */

const RAIZ_STORAGE = path.resolve(process.cwd(), "storage");
const MARCA = "QA-GUARDA-AREA";
const criados: string[] = [];

function criarArquivo(area: string, nome: string): string {
  const relativo = path.join("storage", area, nome);
  const absoluto = path.resolve(process.cwd(), relativo);
  fs.mkdirSync(path.dirname(absoluto), { recursive: true });
  fs.writeFileSync(absoluto, MARCA);
  criados.push(absoluto);
  return relativo.replace(/\\/g, "/");
}

beforeAll(() => {
  fs.mkdirSync(RAIZ_STORAGE, { recursive: true });
});

afterAll(() => {
  criados.forEach((absoluto) => {
    if (!absoluto.startsWith(RAIZ_STORAGE + path.sep)) return;
    if (fs.existsSync(absoluto)) fs.unlinkSync(absoluto);
  });
});

describe("remoção só apaga dentro da própria área", () => {
  it("apaga o original enviado quando ele está em uploads", async () => {
    const ref = criarArquivo("uploads", `${MARCA}-original.docx`);
    const absoluto = path.resolve(process.cwd(), ref);

    await deleteUploadedFile(ref);

    expect(fs.existsSync(absoluto)).toBe(false);
  });

  it("apaga a logo quando ela está em logos", async () => {
    const ref = criarArquivo("logos", `${MARCA}-logo.png`);
    const absoluto = path.resolve(process.cwd(), ref);

    await deleteLogoFile(ref);

    expect(fs.existsSync(absoluto)).toBe(false);
  });

  it("recusa apagar saída gerada pela porta do upload, e não toca no arquivo", async () => {
    const ref = criarArquivo("output", `${MARCA}-saida.docx`);
    const absoluto = path.resolve(process.cwd(), ref);

    await expect(deleteUploadedFile(ref)).rejects.toThrow(/fora do diretório permitido \(uploads\)/);
    expect(fs.existsSync(absoluto)).toBe(true);
  });

  it("recusa apagar original enviado pela porta da saída gerada", async () => {
    const ref = criarArquivo("uploads", `${MARCA}-nao-e-saida.docx`);
    const absoluto = path.resolve(process.cwd(), ref);

    await expect(deleteGeneratedDocx(ref)).rejects.toThrow(/fora do diretório permitido \(output\)/);
    expect(fs.existsSync(absoluto)).toBe(true);
  });

  it("recusa caminho que sobe de diretório", async () => {
    await expect(deleteUploadedFile("storage/uploads/../../package.json")).rejects.toThrow(
      /fora do diretório permitido/
    );
    expect(fs.existsSync(path.resolve(process.cwd(), "package.json"))).toBe(true);
  });

  it("recusa referência do Supabase de outra área antes de falar com a rede", async () => {
    await expect(deleteUploadedFile("supabase://pasta-visa/storage/output/x.docx")).rejects.toThrow(
      /fora do armazenamento permitido \(uploads\)/
    );
    await expect(deleteLogoFile("supabase://pasta-visa/storage/templates/x.docx")).rejects.toThrow(
      /fora do armazenamento permitido \(logos\)/
    );
  });

  it("ignora referência ausente em vez de estourar", async () => {
    await expect(deleteUploadedFile(null)).resolves.toBeUndefined();
    await expect(deleteLogoFile(undefined)).resolves.toBeUndefined();
    await expect(deleteUploadedFile("")).resolves.toBeUndefined();
  });
});
