import { describe, expect, it } from "vitest";
import { logoDosArquivos } from "@/components/planejamento/PlanejamentoEditor";

const arquivo = (nome: string, tipo: string) => new File(["x"], nome, { type: tipo });

describe("logo do planejamento", () => {
  const pasta = [
    arquivo("estercaiafa Preencha esse formulário - 13/09/2026.pdf", "application/pdf"),
    arquivo("IMG_4547 - estercaiafa.jpeg", "image/jpeg"),
    arquivo("logotipo-larissa - estercaiafa.png", "image/png"),
  ];

  it("sem marcação, usa a imagem com logo no nome", () => {
    expect(logoDosArquivos(pasta, null)?.name).toBe("logotipo-larissa - estercaiafa.png");
  });

  it("a marcação na tela vence o nome", () => {
    expect(logoDosArquivos(pasta, "IMG_4547 - estercaiafa.jpeg")?.name).toBe("IMG_4547 - estercaiafa.jpeg");
  });

  it("PDF nunca é logo", () => {
    expect(logoDosArquivos([pasta[0]], pasta[0].name)).toBeUndefined();
  });
});
