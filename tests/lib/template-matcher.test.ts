import { describe, expect, it } from "vitest";
import { findBestTemplateMatch } from "@/lib/template-matcher";

// Recorte do acervo real, com os vizinhos que confundiam a associação.
const ACERVO = [
  ["Controle de Orientações Pós-procedimento", "PLANILHA"],
  ["FICHA - Anamnese Corporal", "FICHA"],
  ["FICHA - Anamnese de Injetáveis", "FICHA"],
  ["FICHA - Anamnese de Injetáveis em Harmonização", "FICHA"],
  ["FICHA - Anamnese de Micropigmentação de Lábios", "FICHA"],
  ["FICHA - Anamnese de Procedimentos Auriculares e Body Piercing", "FICHA"],
  ["FICHA - Anamnese e Avaliação de Terapias Injetáveis e Soroterapia", "FICHA"],
  ["FICHA - Anamnese em Saúde da Mulher", "FICHA"],
  ["FICHA - Anamnese Estética Integrativa", "FICHA"],
  ["FICHA - Anamnese Facial", "FICHA"],
  ["FICHA - Avaliação Corporal e Pós-operatório", "FICHA"],
  ["FICHA - Avaliação e Evolução Capilar e do Couro Cabeludo", "FICHA"],
  ["FICHA - Avaliação Nutricional", "FICHA"],
  ["FICHA - Avaliação para Remoção de Pigmentação Estética", "FICHA"],
  ["FICHA - Avaliação Pediátrica para Furo de Orelha", "FICHA"],
  ["FICHA - Avaliação Podológica", "FICHA"],
  ["FICHA - Cadastro, Anamnese e Avaliação Estética", "FICHA"],
  ["PLANILHA - Limpeza e Desinfecção", "PLANILHA"],
  ["PLANILHA - Rastreabilidade de Produtos", "PLANILHA"],
  ["POP - Avaliação Capilar", "POP"],
  ["POP - Avaliação e Análise de Pele", "POP"],
  ["POP - Avaliação Fisioterapêutica Dermatofuncional", "POP"],
  ["POP - Avaliação Nutricional e Dietética", "POP"],
  ["POP - Avaliação por Bioimpedância", "POP"],
  ["POP - Depilação a Laser", "POP"],
  ["POP - Drenagem Facial e Corporal", "POP"],
  ["POP - Fotobiomodulação", "POP"],
  ["POP - Furo de Orelha em Crianças e Adultos", "POP"],
  ["POP - Furo de Orelha Humanizado", "POP"],
  ["POP - Gestão de Equipamentos", "POP"],
  ["POP - Hemoderivados (PRP e PRF)", "POP"],
  ["POP - HIFU Íntimo (Ultrassom Micro e Macrofocado)", "POP"],
  ["POP - Lash Lifting", "POP"],
  ["POP - Limpeza de Pele", "POP"],
  ["POP - Limpeza de Pele com Recursos Eletroterapêuticos", "POP"],
  ["POP - Limpeza de Superfícies", "POP"],
  ["POP - Limpeza e Manutenção da Climatização", "POP"],
  ["POP - Lobulomodelação (Lobuloplastia Não Cirúrgica)", "POP"],
  ["POP - Manutenção de Equipamentos", "POP"],
  ["POP - Microagulhamento", "POP"],
  ["POP - Peeling de Diamante (Microdermoabrasão)", "POP"],
  ["POP - Peeling Elétrico Facial e Corporal", "POP"],
  ["POP - Peeling Elétrico Íntimo", "POP"],
  ["POP - Peeling Enzimático", "POP"],
  ["POP - Peeling Físico", "POP"],
  ["POP - Peeling Químico Facial e Corporal com Retinol 10% e Mandélico 30%", "POP"],
  ["POP - Peeling Químico Íntimo", "POP"],
  ["POP - Peeling Ultrassônico", "POP"],
  ["POP - Peelings Químicos", "POP"],
  ["POP - Peelings Químicos com Ácido Tricloroacético", "POP"],
  ["POP - PEIM (Escleroterapia)", "POP"],
  ["POP - Pós-operatório Estético (Protocolo Combinado)", "POP"],
  ["POP - Preenchimento Dérmico com Ácido Hialurônico", "POP"],
  ["POP - Preenchimento Labial", "POP"],
  ["POP - Terapia Ortomolecular Intravenosa", "POP"],
  ["POP - Uso de EPIs", "POP"],
  ["REGISTRO - Manutenção, Calibração e Segurança Elétrica dos Equipamentos", "OUTROS"],
  ["Relação de Serviços e Equipamentos", "OUTROS"],
  ["TCLE - Avaliação Capilar", "TCLE"],
  ["TCLE - Depilação a Laser", "TCLE"],
  ["TCLE - Drenagem Linfática no Pós-operatório Estético", "TCLE"],
  ["TCLE - Estética Íntima", "TCLE"],
  ["TCLE - Fotobiomodulação (Laserterapia)", "TCLE"],
  ["TCLE - Furo de Orelha em Bebês", "TCLE"],
  ["TCLE - Furo Humanizado e Piercing em Adultos", "TCLE"],
  ["TCLE - Hemoderivados (PRP e PRF)", "TCLE"],
  ["TCLE - HIFU (Ultrassom Macro e Microfocado)", "TCLE"],
  ["TCLE - Lash Lifting", "TCLE"],
  ["TCLE - Limpeza de Pele", "TCLE"],
  ["TCLE - Lobulomodelação (Lobuloplastia Não Cirúrgica)", "TCLE"],
  ["TCLE - Microagulhamento com Drug Delivery", "TCLE"],
  ["TCLE - Peeling Enzimático", "TCLE"],
  ["TCLE - Peeling Físico (Microdermoabrasão)", "TCLE"],
  ["TCLE - Peeling Ultrassônico", "TCLE"],
  ["TCLE - Peelings Elétricos", "TCLE"],
  ["TCLE - Peelings Químicos", "TCLE"],
  ["TCLE - PEIM (Escleroterapia)", "TCLE"],
  ["TCLE - Preenchimento Dérmico", "TCLE"],
  ["TCLE - Preenchimento Labial", "TCLE"],
  ["TCLE - Protocolo Pós-operatório Estético", "TCLE"],
  ["TCLE - Terapia Ortomolecular e Suplementação Intravenosa", "TCLE"],
  ["TCLE - Ultrassom Estético", "TCLE"],
  ["TCLE - Uso de Imagem (LGPD)", "TCLE"],
  ["TERMO - Ciência e Consentimento para Avaliação por Bioimpedância", "TERMO"],
  ["TERMO - Renúncia e Recusa de Tratamento", "TERMO"],
].map(([nome, tipo], i) => ({ id: String(i), nome, tipo }));

function associar(nome: string): string | null {
  const achado = findBestTemplateMatch(nome, ACERVO);
  return achado ? ACERVO[Number(achado.templateId)].nome : null;
}

describe("associação do documento planejado ao template", () => {
  it.each([
    [
      "POP - Gestão, Verificação e Manutenção de Equipamentos Eletromédicos",
      "POP - Gestão de Equipamentos"
    ],
    [
      "POP: Manutenção Preventiva e Corretiva de Equipamentos",
      "POP - Gestão de Equipamentos"
    ],
    [
      "POP — Limpeza e Manutenção do Sistema de Climatização (ar-condicionado)",
      "POP - Limpeza e Manutenção da Climatização"
    ],
    [
      "POP - Manutenção Preventiva de Equipamentos e Climatização",
      "POP - Manutenção de Equipamentos"
    ],
    [
      "Registro de Manutenção, Calibração e Segurança Elétrica dos Equipamentos",
      "REGISTRO - Manutenção, Calibração e Segurança Elétrica dos Equipamentos"
    ],
    [
      "TCLE — Aplicação de Brincos (Adultos)",
      "TCLE - Furo Humanizado e Piercing em Adultos"
    ],
    [
      "TCLE — HIFU — Ultrassom Micro e Macrofocado",
      "TCLE - HIFU (Ultrassom Macro e Microfocado)"
    ],
    [
      "TCLE — Ultrassom Microfocado e Macrofocado",
      "TCLE - HIFU (Ultrassom Macro e Microfocado)"
    ],
    [
      "POP - Peeling de ATA (Contempla IV.10)",
      "POP - Peelings Químicos com Ácido Tricloroacético"
    ],
    [
      "TCLE - Peeling de ATA (Ácido Tricloroacético)",
      "TCLE - Peelings Químicos"
    ],
    [
      "Ficha de Anamnese e Avaliação Estética (adultos)",
      "FICHA - Cadastro, Anamnese e Avaliação Estética"
    ],
    [
      "Ficha de Avaliação Capilar",
      "FICHA - Avaliação e Evolução Capilar e do Couro Cabeludo"
    ],
    [
      "Registro de Entrega de Orientações Pós-Procedimentos",
      "Controle de Orientações Pós-procedimento"
    ],
    [
      "POP — Procedimento Estético para Micro Vasos (PEIM)",
      "POP - PEIM (Escleroterapia)"
    ],
    [
      "TCLE para Plasma Rico em Plaquetas (PRP)",
      "TCLE - Hemoderivados (PRP e PRF)"
    ],
    [
      "POP – Suplementação endovenosa",
      "POP - Terapia Ortomolecular Intravenosa"
    ],
    [
      "Termo de Autorização para Uso de Imagem e Registro Fotográfico",
      "TCLE - Uso de Imagem (LGPD)"
    ],
    [
      "Termo de Recusa ou Interrupção de Tratamento",
      "TERMO - Renúncia e Recusa de Tratamento"
    ],
    [
      "Planilha de Controle de Limpeza Concorrente e Terminal",
      "PLANILHA - Limpeza e Desinfecção"
    ],
    [
      "Planilha de Rastreabilidade de Injetáveis, Lotes e Insumos",
      "PLANILHA - Rastreabilidade de Produtos"
    ],
    [
      "TCLE - Microagulhamento Facial",
      "TCLE - Microagulhamento com Drug Delivery"
    ],
    [
      "TCLE — Estética Íntima Não Cirúrgica",
      "TCLE - Estética Íntima"
    ],
    [
      "TCLE — Preenchimento Corporal",
      "TCLE - Preenchimento Dérmico"
    ],
    [
      "POP — Pós-Operatório Estético (Fotobiomodulação Ibramed; Bota compressiva Ibramed; Ultrassom estético)",
      "POP - Pós-operatório Estético (Protocolo Combinado)"
    ],
    [
      "POP — Paramentação e Uso de Equipamentos de Proteção Individual (EPIs)",
      "POP - Uso de EPIs"
    ],
    [
      "POP - Epilação a Laser (Contempla III.27)",
      "POP - Depilação a Laser"
    ]
  ])("%s → %s", (documento, template) => {
    expect(associar(documento)).toBe(template);
  });

  // Melhor sem template (a Ester escolhe) do que com um parecido de outro assunto.
  it.each([
    "POP - Laser para Tratamento Estético de Hiperpigmentações",
    "POP: Power Lifting (Rejuvenescimento)",
    "POP - Antissepsia da Pele (Contempla VII.3)",
    "POP — Avaliação Estética Facial e Corporal"
  ])("%s fica sem template", (documento) => {
    expect(associar(documento)).toBeNull();
  });
});
