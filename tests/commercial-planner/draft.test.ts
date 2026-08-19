// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDraft,
  DRAFT_KEY,
  DRAFT_TTL_MS,
  readDraft,
  writeDraft,
} from "@/lib/commercial-planner/draft";
import type { PublicCommercialPlan } from "@/lib/commercial-planner/types";

/**
 * O jsdom desta suíte expõe um localStorage incompleto, então o armazenamento é
 * trocado por um de memória com a API inteira — que é o que um navegador real dá.
 */
function instalarArmazenamento(): Map<string, string> {
  const dados = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => void dados.set(chave, valor),
      removeItem: (chave: string) => void dados.delete(chave),
      clear: () => dados.clear(),
      key: (indice: number) => Array.from(dados.keys())[indice] ?? null,
      get length() {
        return dados.size;
      },
    },
  });
  return dados;
}

const plano = {
  procedimentos: ["Limpeza de pele"],
  documentos: [{ nome: "POP — Limpeza de pele", tipo: "POP" }],
  vinculos: [{ documento: "POP — Limpeza de pele", tipo: "POP", procedimentos: ["Limpeza de pele"] }],
  alertas: [],
  alertasReservados: [],
  resumo: { totalProcedimentos: 1, totalDocumentos: 1, revisaoTecnicaObrigatoria: true },
  aviso: "Pré-planejamento comercial provisório, sujeito à validação da equipe técnica.",
} as PublicCommercialPlan;

function rascunho(overrides: Partial<Parameters<typeof writeDraft>[0]> = {}) {
  return {
    etapa: 2,
    cliente: "Clínica Aurora",
    municipio: "Belo Horizonte",
    uf: "MG",
    procedimentos: "Limpeza de pele",
    equipamentos: "",
    reutilizaMateriais: false,
    possuiAutoclave: null,
    analise: { plano, token: "token-assinado" },
    retirados: [],
    formato: "digital" as const,
    ...overrides,
  };
}

let dados: Map<string, string>;

beforeEach(() => {
  dados = instalarArmazenamento();
});

afterEach(() => {
  dados.clear();
});

describe("rascunho do planejamento no navegador", () => {
  it("guarda e devolve o atendimento em andamento", () => {
    writeDraft(rascunho());

    expect(readDraft()).toMatchObject({
      etapa: 2,
      cliente: "Clínica Aurora",
      uf: "MG",
      analise: { token: "token-assinado" },
    });
  });

  it("vence junto com o token assinado e não devolve rascunho velho", () => {
    writeDraft(rascunho());
    const guardado = JSON.parse(dados.get(DRAFT_KEY)!);
    dados.set(DRAFT_KEY, JSON.stringify({ ...guardado, salvoEm: Date.now() - DRAFT_TTL_MS - 1000 }));

    expect(readDraft()).toBeNull();
    expect(dados.has(DRAFT_KEY)).toBe(false);
  });

  it("descarta conteúdo corrompido em vez de quebrar o atendimento", () => {
    dados.set(DRAFT_KEY, "{isto não é json");

    expect(readDraft()).toBeNull();
    expect(dados.has(DRAFT_KEY)).toBe(false);
  });

  it("some quando o atendimento recomeça", () => {
    writeDraft(rascunho());
    clearDraft();

    expect(readDraft()).toBeNull();
  });

  it("não quebra quando o navegador não dá armazenamento", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("bloqueado");
      },
    });

    expect(() => writeDraft(rascunho())).not.toThrow();
    expect(readDraft()).toBeNull();
    expect(() => clearDraft()).not.toThrow();
  });

  it("não quebra quando o armazenamento é incompleto", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem: () => null },
    });

    expect(() => writeDraft(rascunho())).not.toThrow();
    expect(readDraft()).toBeNull();
  });
});
