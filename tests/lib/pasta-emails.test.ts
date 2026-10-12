import { describe, expect, it } from "vitest";
import {
  assuntoInicial,
  EMAILS,
  entregaDaVersao,
  montarEmail,
  problemasDoEmail,
  valoresIniciais,
} from "@/lib/emails/pasta-emails";

const pasta = {
  clienteNomeFantasia: "Clínica Bela & Cia",
  clienteProprietarioNome: "Camila Costa",
  clienteCidade: "Rio de Janeiro",
  clienteEstado: "RJ",
  clienteEmail: "camila@example.com",
  inicioProjeto: "2026-10-08T12:00:00.000Z",
  linkDrive: "https://drive.google.com/drive/folders/abc",
  linkOneDrive: "https://1drv.ms/f/xyz",
  senhaOneDrive: "camila123@",
};

describe("e-mails da pasta", () => {
  it("cada modelo tem todos os campos que o HTML pede, e só eles", () => {
    for (const email of EMAILS) {
      const html = montarEmail(email.tipo, {}, "envio");
      expect(html, email.tipo).not.toMatch(/\{\{[A-Z_]+\}\}/);
      expect(html, email.tipo).toContain("cid:logo-treinavisa");
      expect(html, email.tipo).not.toContain("data:image");
    }
  });

  it("preenche a partir da pasta", () => {
    expect(valoresIniciais("boas-vindas", pasta, 0)).toEqual({
      NOME_CLIENTE: "Camila Costa",
      NOME_ESTABELECIMENTO: "Clínica Bela & Cia",
      DATA_INICIO: "08/10/2026",
      MUNICIPIO_UF: "Rio de Janeiro (RJ)",
      EMAIL_LEITOR: "camila@example.com",
      LINK_PASTA: "https://drive.google.com/drive/folders/abc",
    });
    expect(valoresIniciais("apreciacao", pasta, 0)).toMatchObject({
      LINK_PASTA: "https://1drv.ms/f/xyz",
      SENHA: "camila123@",
      PRAZO_DIAS: "03 (três)",
    });
    expect(valoresIniciais("entrega-digital", pasta, 42).NUM_DOCUMENTOS).toBe("42");
    expect(assuntoInicial("apreciacao", pasta)).toBe("Período de Apreciação da Pasta Sanitária · Clínica Bela & Cia");
  });

  it("escapa o texto no HTML e mostra a logo na prévia", () => {
    const valores = valoresIniciais("boas-vindas", pasta, 0);
    const html = montarEmail("boas-vindas", valores, "previa");
    expect(html).toContain("Clínica Bela &amp; Cia");
    expect(html).toContain("data:image/png;base64,");
    expect(html).not.toContain("cid:logo-treinavisa");
  });

  it("aponta o que falta antes de enviar", () => {
    expect(problemasDoEmail("entrega-fisica", valoresIniciais("entrega-fisica", pasta, 10))).toEqual([]);
    expect(
      problemasDoEmail("entrega-fisica", { SAUDACAO: "Prezada", NOME_CLIENTE: "Ana", NUM_DOCUMENTOS: "dez", LINK_PASTA: "http://x" })
    ).toEqual([
      '"Quantidade de documentos" aceita só números.',
      '"Link da pasta digital (Drive)" precisa ser um link que começa com https://.',
    ]);
  });

  it("escolhe o e-mail de entrega pela versão da pasta", () => {
    expect(entregaDaVersao("Digital")).toBe("entrega-digital");
    expect(entregaDaVersao(null)).toBe("entrega-digital");
    expect(entregaDaVersao("Digital + Colorida")).toBe("entrega-fisica");
    expect(entregaDaVersao("Digital + Preto e Branco")).toBe("entrega-fisica");
  });
});
