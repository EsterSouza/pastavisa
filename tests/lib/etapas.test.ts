import { describe, expect, it } from "vitest";
import { ehEtapa, etapaDa, gravacaoDaEtapa } from "@/lib/etapas";

describe("etapas da pasta", () => {
  it("lê a etapa: concluída é entregue, sem etapa é produção", () => {
    expect(etapaDa({ status: "concluida", etapa: "revisao" })).toBe("entregue");
    expect(etapaDa({ status: "processando", etapa: null })).toBe("producao");
    expect(etapaDa({ status: "rascunho", etapa: "impressao" })).toBe("impressao");
    expect(etapaDa({ status: "rascunho", etapa: "lixo" })).toBe("producao");
  });

  it("grava: entregue conclui, as outras reabrem a pasta concluída", () => {
    expect(gravacaoDaEtapa("entregue", "rascunho")).toEqual({ status: "concluida" });
    expect(gravacaoDaEtapa("revisao", "concluida")).toEqual({ etapa: "revisao", status: "rascunho" });
    expect(gravacaoDaEtapa("producao", "processando")).toEqual({ etapa: null });
  });

  it("só aceita etapa conhecida", () => {
    expect(ehEtapa("impressao")).toBe(true);
    expect(ehEtapa("concluida")).toBe(false);
    expect(ehEtapa(null)).toBe(false);
  });
});
