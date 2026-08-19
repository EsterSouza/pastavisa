import { describe, expect, it } from "vitest";
import {
  AMBIGUOUS_TERMS,
  EQUIPMENT_TERMS,
  POPULAR_TERMS,
  ambiguousTermsBlock,
  equipmentTermsBlock,
  popularTermsBlock,
} from "@/lib/commercial-planner/vocabulary";
import { forbiddenReason, outOfScopeReason } from "@/lib/commercial-planner/scope";

/**
 * O vocabulário cresce toda vez que aparece um jeito novo de a cliente escrever. O
 * risco de crescer é a contradição: o mesmo apelido em duas linhas, ou um termo que
 * a lista manda nomear e a outra manda perguntar. Estes testes existem para que
 * acrescentar verbete continue sendo seguro.
 */

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function apelidos(pares: ReadonlyArray<readonly [string, string]>): string[] {
  return pares.flatMap(([termos]) => termos.split(",").map(normalizar));
}

describe("vocabulário comercial", () => {
  it("só nomeia técnica que cabe nesta pasta e que a lei permite", () => {
    for (const [, nomeTecnico] of POPULAR_TERMS) {
      expect(outOfScopeReason(nomeTecnico), nomeTecnico).toBeNull();
      expect(forbiddenReason(nomeTecnico), nomeTecnico).toBeNull();
    }
  });

  it("não repete o mesmo apelido em duas linhas", () => {
    const vistos = new Map<string, string>();

    for (const [termos, nomeTecnico] of POPULAR_TERMS) {
      for (const apelido of termos.split(",").map(normalizar)) {
        expect(vistos.get(apelido), `“${apelido}” já aponta para ${vistos.get(apelido)}`).toBeUndefined();
        vistos.set(apelido, nomeTecnico);
      }
    }
  });

  it("não manda nomear e perguntar o mesmo termo", () => {
    const populares = new Set(apelidos(POPULAR_TERMS));

    for (const [termo] of AMBIGUOUS_TERMS) {
      expect(populares.has(normalizar(termo)), termo).toBe(false);
    }
  });

  it("não trata o mesmo aparelho como técnica e como pergunta", () => {
    const populares = new Set(apelidos(POPULAR_TERMS));

    for (const aparelho of apelidos(EQUIPMENT_TERMS)) {
      expect(populares.has(aparelho), aparelho).toBe(false);
    }
  });

  it("entrega cada lista como uma linha por verbete", () => {
    expect(popularTermsBlock().split("\n")).toHaveLength(POPULAR_TERMS.length);
    expect(ambiguousTermsBlock().split("\n")).toHaveLength(AMBIGUOUS_TERMS.length);
    expect(equipmentTermsBlock().split("\n")).toHaveLength(EQUIPMENT_TERMS.length);
  });

  it("guarda os nomes que a cliente escreve no lugar da técnica", () => {
    const bloco = normalizar(popularTermsBlock());

    for (const escrita of ["botox", "dysport", "sculptra", "ultraformer", "microblading", "coolsculpting"]) {
      expect(bloco, escrita).toContain(escrita);
    }
  });
});
