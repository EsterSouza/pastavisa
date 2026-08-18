import { describe, expect, it } from "vitest";
import { toPublicPlannerOutput } from "@/lib/commercial-planner/output";
import { officialDocument, officialDocumentNames, procedureDocumentName } from "@/lib/commercial-planner/naming";
import { buildBaselineDocuments } from "@/lib/commercial-planner/baseline";
import type {
  CommercialPlannerInput,
  CoverageCandidate,
  DocumentRole,
  InternalCommercialPlan,
} from "@/lib/commercial-planner/types";

function documento(overrides: Partial<CoverageCandidate> = {}): CoverageCandidate {
  return {
    key: "chave",
    catalogId: "id-interno",
    documentName: "POP Limpeza Pele",
    documentType: "POP",
    role: "procedure" as DocumentRole,
    techniques: ["Limpeza de Pele"],
    mode: "exact",
    equivalent: true,
    uncertain: false,
    ...overrides,
  };
}

function plano(documents: CoverageCandidate[], tecnicas: string[] = ["Limpeza de Pele"]): InternalCommercialPlan {
  const techniques = tecnicas.map((name) => ({ name, evidence: [name] }));
  return { techniques, documents, alerts: [], coverage: { techniques, candidates: documents, alerts: [] } };
}

function pedido(overrides: Partial<CommercialPlannerInput> = {}): CommercialPlannerInput {
  return { cliente: "Clínica", procedimentos: "Limpeza de pele", equipamentos: [], ...overrides };
}

describe("nome público dos documentos", () => {
  it("nomeia POP e TCLE pela técnica declarada, não pelo arquivo de origem", () => {
    const saida = toPublicPlannerOutput(
      plano([
        documento({ documentName: "POP Limpeza Pele" }),
        documento({
          key: "tcle",
          documentName: "TCLE Limpeza Pele",
          documentType: "TCLE",
          role: "consent",
        }),
      ])
    );

    expect(saida.documentos).toEqual([
      { nome: "POP — Limpeza de Pele", tipo: "POP" },
      { nome: "TCLE — Limpeza de Pele", tipo: "TCLE" },
    ]);
  });

  it("cita todas as técnicas quando um termo cobre mais de uma", () => {
    expect(procedureDocumentName("TCLE", ["Peeling Químico"])).toBe("TCLE — Peeling Químico");
    expect(procedureDocumentName("TCLE", ["Peeling Químico", "Peeling Enzimático"])).toBe(
      "TCLE — Peeling Químico e Peeling Enzimático"
    );
    expect(procedureDocumentName("POP", ["Toxina Botulínica", "Preenchimento", "Fios de PDO"])).toBe(
      "POP — Toxina Botulínica, Preenchimento e Fios de PDO"
    );
  });

  it("dá nome e tipo oficiais aos documentos que não nascem de técnica", () => {
    expect(officialDocument("MBP Servico Saude")).toEqual({
      nome: "Manual de Boas Práticas em Serviço de Saúde",
      tipo: "MBP",
    });
    expect(officialDocument("Plano Contingencia")).toEqual({
      nome: "Plano de Contingência e Emergências",
      tipo: "PLANO",
    });
    expect(officialDocument("Planilha Limpeza Desinfeccao")).toEqual({
      nome: "Planilha de Controle de Limpeza Concorrente e Terminal",
      tipo: "PLANILHA",
    });
    expect(officialDocument("POP - GESTAO DE EQUIPAMENTOS")).toEqual({
      nome: "POP — Gestão e Manutenção de Equipamentos Eletromédicos",
      tipo: "POP",
    });
  });

  it("é idempotente: um nome já oficial não é reescrito", () => {
    const oficial = officialDocument("Manual de Boas Práticas em Serviço de Saúde")!;
    expect(officialDocument(oficial.nome)).toEqual(oficial);
  });

  it("barra o documento sem verbete em vez de mandar o nome da origem", () => {
    // A Ester encontrou “Administração de Anestésico Local” no PDF: não existe como
    // documento em planejamento nenhum. Sem verbete, o documento não sai.
    expect(officialDocument("ADMINISTRAÇÃO DE ANESTÉSICO LOCAL")).toBeNull();
    expect(officialDocument("DOCUMENTO QUE NAO EXISTE")).toBeNull();
  });

  it("não deixa documento sem verbete chegar à saída pública", () => {
    const saida = toPublicPlannerOutput(
      plano([
        documento(),
        documento({
          key: "anestesico",
          documentName: "ADMINISTRAÇÃO DE ANESTÉSICO LOCAL",
          documentType: "OUTROS",
          role: "general",
          techniques: [],
        }),
      ])
    );

    expect(saida.documentos.map((item) => item.nome)).toEqual(["POP — Limpeza de Pele"]);
    expect(JSON.stringify(saida)).not.toMatch(/anest[eé]sico/i);
  });

  it("não deixa passar categoria que a pasta não traz", () => {
    const saida = toPublicPlannerOutput(
      plano([
        documento(),
        documento({ key: "r", documentName: "Receituario Pos Procedimento", documentType: "RECEITUARIO", role: "record", techniques: [] }),
        documento({ key: "c", documentName: "Contrato de Prestação de Serviços", documentType: "OUTROS", role: "general", techniques: [] }),
        documento({ key: "o", documentName: "Orientações Pós-Procedimento de Peeling", documentType: "OUTROS", role: "general", techniques: [] }),
        documento({ key: "t", documentName: "Certificado de Participação", documentType: "OUTROS", role: "general", techniques: [] }),
      ])
    );

    expect(saida.documentos.map((item) => item.nome)).toEqual(["POP — Limpeza de Pele"]);
  });

  it("mantém o controle de entrega, que é registro da pasta e não a orientação em si", () => {
    const saida = toPublicPlannerOutput(
      plano([
        documento({ key: "ctrl", documentName: "Controle Entrega Pos Procedimento", documentType: "PLANILHA", role: "record", techniques: [] }),
      ])
    );

    expect(saida.documentos).toEqual([
      { nome: "Controle de Entrega de Orientações Pós-Procedimentos", tipo: "PLANILHA" },
    ]);
  });
});

describe("base obrigatória da pasta", () => {
  it("entra sempre, sem depender de procedimento declarado", () => {
    const nomes = buildBaselineDocuments(pedido(), []).map((item) => item.documentName);

    expect(nomes).toContain("Manual de Boas Práticas em Serviço de Saúde");
    expect(nomes).toContain("POP — Higienização das Mãos");
    expect(nomes).toContain("POP — Limpeza e Desinfecção de Superfícies, Mobiliários, Macas e Equipamentos de Apoio");
    expect(nomes).toContain("Formulário de Intercorrências e Eventos Adversos");
    expect(nomes).toContain("TCLE — Autorização para Uso de Imagem e Registro Fotográfico");
  });

  it("acrescenta o que depende da operação declarada", () => {
    const semInjetavel = buildBaselineDocuments(pedido({ procedimentos: "Limpeza de pele" }), ["Limpeza de pele"]);
    const comInjetavel = buildBaselineDocuments(
      pedido({ procedimentos: "Toxina botulínica e preenchimento" }),
      ["Toxina Botulínica"]
    );
    const nomes = (lista: typeof semInjetavel) => lista.map((item) => item.documentName);

    expect(nomes(semInjetavel)).not.toContain("POP — Prevenção e Conduta Inicial em Oclusão Vascular");
    expect(nomes(comInjetavel)).toContain("POP — Prevenção e Conduta Inicial em Oclusão Vascular");
    expect(nomes(comInjetavel)).toContain("Ficha de Anamnese para Injetáveis e Harmonização");
    expect(nomes(comInjetavel)).toContain("POP — Limpeza do Refrigerador Clínico");
  });

  it("inclui a ficha auricular quando há perfuração declarada", () => {
    const nomes = buildBaselineDocuments(pedido({ procedimentos: "Body piercing" }), ["Body Piercing"]).map(
      (item) => item.documentName
    );

    expect(nomes).toContain("Ficha de Anamnese para Procedimentos Auriculares e Body Piercing");
  });

  it("pede o controle de material de uso único quando nada é reutilizado", () => {
    const descartavel = buildBaselineDocuments(pedido({ reutilizaMateriais: false }), []).map(
      (item) => item.documentName
    );
    const reutiliza = buildBaselineDocuments(pedido({ reutilizaMateriais: true }), []).map(
      (item) => item.documentName
    );

    expect(descartavel).toContain("POP — Uso de Materiais Descartáveis e Controle de Materiais de Uso Único");
    expect(reutiliza).not.toContain("POP — Uso de Materiais Descartáveis e Controle de Materiais de Uso Único");
  });

  it("tem verbete oficial para cada documento seu, senão a lista fechada o engoliria", () => {
    const oficiais = new Set(officialDocumentNames());
    for (const item of buildBaselineDocuments(pedido({ reutilizaMateriais: false }), ["Toxina Botulínica", "Body Piercing"])) {
      expect(oficiais).toContain(item.documentName);
    }
  });

  it("sai sem técnica vinculada, para permanecer quando o comercial retira procedimentos", () => {
    for (const item of buildBaselineDocuments(pedido(), ["Limpeza de Pele"])) {
      expect(item.techniques).toEqual([]);
      expect(item.catalogId).toBeNull();
    }
  });
});

describe("ordem de entrega da pasta", () => {
  it("entrega institucionais, depois POP, ficha, TCLE, termo, registros e o resto", () => {
    const tipos = toPublicPlannerOutput(
      plano(
        [
          documento({ key: "guia", documentName: "Guia Utilizacao Pasta Sanitaria", documentType: "GUIA", role: "general", techniques: [] }),
          documento({ key: "planilha", documentName: "Planilha Controle Temperatura", documentType: "PLANILHA", role: "record", techniques: [] }),
          documento({ key: "tcle", documentName: "TCLE Limpeza Pele", documentType: "TCLE", role: "consent" }),
          documento({ key: "ficha", documentName: "Ficha Anamnese Facial", documentType: "FICHA", role: "record", techniques: [] }),
          documento({ key: "pop", documentName: "POP Limpeza Pele", documentType: "POP", role: "procedure" }),
          documento({ key: "form", documentName: "FORM EVENTO ADVERSO", documentType: "OUTROS", role: "record", techniques: [] }),
          documento({ key: "relacao", documentName: "Relacao Servicos Equipamentos", documentType: "OUTROS", role: "general", techniques: [] }),
          documento({ key: "termo", documentName: "Termo Renuncia Recusa Tratamento", documentType: "TERMO", role: "general", techniques: [] }),
          documento({ key: "pgrss", documentName: "PGRSS", documentType: "PGRSS", role: "general", techniques: [] }),
          documento({ key: "mbp", documentName: "MBP Servico Saude", documentType: "MBP", role: "general", techniques: [] }),
          documento({ key: "psp", documentName: "PSP", documentType: "OUTROS", role: "general", techniques: [] }),
          documento({ key: "contingencia", documentName: "Plano Contingencia", documentType: "OUTROS", role: "general", techniques: [] }),
        ],
        ["Limpeza de Pele"]
      )
    ).documentos.map((item) => item.tipo);

    expect(tipos).toEqual([
      "MBP",
      "PGRSS",
      "PLANO",
      "PLANO",
      "RELAÇÃO",
      "POP",
      "FICHA",
      "TCLE",
      "TERMO",
      "PLANILHA",
      "FORMULÁRIO",
      "GUIA",
    ]);
  });

  it("põe o Plano de Segurança do Paciente antes dos outros planos", () => {
    const nomes = toPublicPlannerOutput(
      plano([
        documento({ key: "contingencia", documentName: "Plano Contingencia", documentType: "OUTROS", role: "general", techniques: [] }),
        documento({ key: "psp", documentName: "PSP", documentType: "OUTROS", role: "general", techniques: [] }),
      ])
    ).documentos.map((item) => item.nome);

    expect(nomes).toEqual(["Plano de Segurança do Paciente", "Plano de Contingência e Emergências"]);
  });
});
