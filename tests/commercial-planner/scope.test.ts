import { describe, expect, it } from "vitest";
import { outOfScopeAlerts, outOfScopeReason } from "@/lib/commercial-planner/scope";

/**
 * A fronteira do escopo derruba atividade de outro regime sanitário. O risco real
 * dela é o oposto: derrubar estética legítima cujo nome contém "cirúrgico",
 * "laboratorial" ou "hospitalar". Os nomes usados aqui são os do acervo da equipe.
 */

const DENTRO = [
  "Toxina Botulínica",
  "Preenchimento Dérmico com Ácido Hialurônico",
  "Jato de Plasma — blefaroplastia sem corte",
  "Otomodelação Não Cirúrgica",
  "Lobulomodelação e lobuloplastia não cirúrgica",
  "Lipo enzimática sem corte",
  "Cavitação lipo sem corte",
  "Laserterapia pós-cirúrgica",
  "Laserterapia pós furo e piercing",
  "Taping pós-cirúrgico",
  "Pós-operatório estético com protocolo combinado",
  "Ficha de avaliação corporal e pós-operatório",
  "Retirada de pontos cirúrgicos",
  "Plasma Rico em Plaquetas (PRP)",
  "Plasma Gel Autólogo",
  "Hemoderivados PRP e PRF",
  "Coleta de amostras laboratoriais e flebotomia",
  "Coleta de citopatológico em meio líquido e DNA HPV",
  "Testes rápidos diagnósticos",
  "Ultrassom Microfocado e Macrofocado",
  "Microagulhamento e Drug Delivery",
  "Harmonização Facial",
  "Body Piercing",
  "Podologia",
];

const FORA: Array<[string, RegExp]> = [
  ["Lipoaspiração", /cir[úu]rgic/i],
  ["Lipo HD", /cir[úu]rgic/i],
  ["Abdominoplastia", /cir[úu]rgic/i],
  ["Rinoplastia", /cir[úu]rgic/i],
  ["Blefaroplastia cirúrgica", /cir[úu]rgic/i],
  ["Implante capilar", /cir[úu]rgic/i],
  ["Clareamento dental", /bucal|odontolog/i],
  ["Ortodontia", /bucal|odontolog/i],
  ["Aplicação de toxina botulínica por dentista em consultório odontológico", /bucal|odontolog/i],
  ["Internação de curta permanência", /interna/i],
  ["Day hospital com leitos", /interna/i],
  ["Diagnóstico por imagem", /imagem/i],
  ["Ultrassonografia diagnóstica", /imagem/i],
  ["Raio X odontológico", /bucal|odontolog|imagem/i],
  ["Laboratório de análises clínicas", /an[áa]lises cl[íi]nicas|laborat/i],
  ["Biópsia de pele", /an[áa]lises cl[íi]nicas|laborat/i],
  ["Hemoterapia e transfusão", /hemoterapia|sangue/i],
  ["Radioterapia", /alta complexidade/i],
  ["Hemodiálise", /alta complexidade/i],
  ["Farmácia de manipulação", /manipula|veterin/i],
  ["Clínica veterinária", /manipula|veterin/i],
];

describe("fronteira do escopo da pasta", () => {
  it("não derruba estética legítima com nome parecido", () => {
    for (const tecnica of DENTRO) {
      expect(outOfScopeReason(tecnica), tecnica).toBeNull();
    }
  });

  it("barra atividade de outro regime sanitário, dizendo qual", () => {
    for (const [tecnica, esperado] of FORA) {
      const motivo = outOfScopeReason(tecnica);
      expect(motivo, tecnica).not.toBeNull();
      expect(motivo!, tecnica).toMatch(esperado);
    }
  });

  it("avisa o comercial sobre o que o cliente declarou e não entra na pasta", () => {
    const avisos = outOfScopeAlerts(
      "limpeza de pele, botox, lipoaspiração, clareamento dental e ultrassonografia diagnóstica"
    );

    expect(avisos).toHaveLength(3);
    for (const aviso of avisos) {
      expect(aviso).toMatch(/não é atendida por esta pasta/);
      expect(aviso).toMatch(/separadamente com a equipe técnica/);
    }
  });

  it("não avisa nada quando a operação é toda estética", () => {
    expect(
      outOfScopeAlerts("limpeza de pele, peeling químico, microagulhamento, botox e preenchimento labial")
    ).toEqual([]);
  });

  it("não confunde procedimento estético pós-cirúrgico com cirurgia", () => {
    expect(outOfScopeAlerts("drenagem linfática pós-operatória e laserterapia pós-cirúrgica")).toEqual([]);
    expect(outOfScopeAlerts("blefaroplastia sem corte com jato de plasma")).toEqual([]);
  });
});

describe("aviso de escopo como rede de segurança", () => {
  it("fica calado quando a análise já explicou o termo pelo nome", () => {
    const jaExplicado = [
      "Lipoaspiração é procedimento cirúrgico e não entra nesta pasta sanitária.",
    ];

    expect(outOfScopeAlerts("limpeza de pele e lipoaspiracao", jaExplicado)).toEqual([]);
  });

  it("fala quando a análise deixou o termo passar em silêncio", () => {
    const outroAssunto = ["Cliente não reutiliza materiais e não possui autoclave."];
    const avisos = outOfScopeAlerts("limpeza de pele e lipoaspiracao", outroAssunto);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/cirúrgico/);
  });

  it("fala só do que sobrou, quando a análise cobriu parte", () => {
    const parcial = ["Clareamento dental é atividade odontológica e não entra nesta pasta."];
    const avisos = outOfScopeAlerts("clareamento dental, lipoaspiracao e botox", parcial);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/cirúrgico/);
  });
});
