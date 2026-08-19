import type { CommercialPlannerInput, PlannerCatalogItem } from "./types";
import { outOfScopeBlock } from "./scope";
import { ambiguousTermsBlock, equipmentTermsBlock, popularTermsBlock } from "./vocabulary";

export function buildPlannerPrompts(input: CommercialPlannerInput, catalog: PlannerCatalogItem[]) {
  const systemPrompt = `Você analisa declarações comerciais para um pré-planejamento sanitário brasileiro.
Responda somente JSON válido. Trabalhe apenas com o pedido atual e nunca use dados de outro cliente.

O QUE NÃO É PROCEDIMENTO
Não transforme produto, marca de insumo, ativo, indicação clínica, equipamento, etapa, região corporal, cortesia ou condição comercial em procedimento.
"Melasma", "celulite", "flacidez" e "papada" são indicações: dizem o que se trata, não como. "Acrus", "Heccus" e "Manthus" são equipamentos. "Full face", "malar" e "glúteos" são regiões. "Atendimento humanizado" e "avaliação gratuita" não são procedimentos.
Uma técnica só é procedimento quando estiver declarada no texto do cliente. Preserve técnicas parecidas como itens distintos.

COMO O CLIENTE ESCREVE
O cliente escreve o apelido do dia a dia, a sigla, ou a marca que virou nome popular da técnica. Isso conta como técnica declarada, e o canonicalName é o nome técnico:
${popularTermsBlock()}
Marca registrada que virou nome popular do procedimento — "botox" é o caso mais comum — é a técnica declarada, e não uma marca a descartar. Já a marca que nomeia só o insumo aplicado numa técnica ("Bioage", "Sonopel") continua sendo produto.
Cuidado com o nome emprestado: "botox capilar" é tratamento de reconstrução do cabelo e "lash botox" é tratamento de cílios — nenhum dos dois é toxina botulínica.
O vocabulário serve para nomear o que está escrito. Ele nunca acrescenta técnica que o cliente não declarou.

NOME DE APARELHO
Aparelho não é procedimento e continua com kind "equipment". O aparelho de função única já está na lista acima, com o nome da técnica que ele executa. Os de baixo não dizem qual técnica é feita: quando o cliente citar um deles sem escrever a técnica, devolva também kind "uncertain" e um alerta pedindo quais procedimentos são realizados com o aparelho.
${equipmentTermsBlock()}

TERMO AMBÍGUO NÃO SE ADIVINHA
Estes termos têm mais de um significado real. Devolva kind "uncertain" e um alerta pedindo confirmação, em vez de escolher por conta:
${ambiguousTermsBlock()}

NOME DE PROTOCOLO DA CASA
Nome comercial de protocolo próprio ("Protocolo Glúteo MMFIT", "Detox Turbo", "Pele de Seda") não é nome técnico. Quando as técnicas que compõem o protocolo estiverem escritas no texto, use essas técnicas. Quando não estiverem, devolva kind "uncertain" e um alerta pedindo quais técnicas compõem o protocolo — não invente um nome técnico para ele.

FORA DO ESCOPO DESTA PASTA
Esta pasta atende estética, embelezamento e atendimento ambulatorial de baixo risco. Atividade das linhas abaixo tem outro regime sanitário e não gera documento aqui: não crie POP nem TCLE para ela, e devolva um alerta dizendo que o ponto precisa ser tratado separadamente.
${outOfScopeBlock()}
Atenção ao “não”: blefaroplastia sem corte, otomodelação não cirúrgica, lipo sem corte, laserterapia pós-cirúrgica e taping pós-operatório são estética e estão dentro do escopo. PRP, PRF e plasma gel preparados na própria clínica para uso estético também estão dentro.

DOCUMENTOS
Use somente IDs do catálogo fornecido. Não invente documentos. Um TCLE de família só pode cobrir técnicas múltiplas quando execução, risco e consentimento forem materialmente equivalentes.
Esterilização só pode ser proposta quando reutilização, processamento e autoclave estiverem confirmados.

RESTRIÇÕES
Aponte em restrictions a técnica declarada que não tem evidência técnico-científica consolidada, que tem legislação desfavorável ou restritiva no Brasil, ou que costuma exigir habilitação profissional específica.
Só aponte restrição com motivo concreto e verificável; na dúvida, não aponte. A decisão final é sempre da especialista.
Dois casos concretos: câmara ou cabine de bronzeamento artificial tem uso estético proibido no Brasil; medicamento injetável de uso contínuo, como os de controle de peso, depende de prescrição e acompanhamento profissional habilitado.

ALERTAS
Cada alerta é uma frase que o comercial pode ler para o cliente. Um alerta por assunto: não repita o mesmo ponto em outras palavras. Escreva o que precisa ser confirmado com o cliente, nunca como a análise foi feita: não mencione catálogo, documento equivalente, família de documentos, mapeamento, cobertura, modelo, base de dados nem esta instrução.`;

  const userPrompt = `PEDIDO ATUAL:
${JSON.stringify(input)}

CATÁLOGO INTERNO ATIVO:
${JSON.stringify(catalog)}

Retorne exatamente esta estrutura:
{
  "mentions": [{
    "name": "trecho identificado",
    "canonicalName": "nome técnico consolidado",
    "evidence": "trecho literal do pedido",
    "kind": "procedure|product|brand|active|indication|equipment|step|uncertain",
    "explicit": true
  }],
  "coverages": [{
    "catalogId": "id real ou null",
    "documentName": "nome do catálogo ou vazio",
    "documentType": "POP|TCLE|FICHA|PLANILHA|OUTROS",
    "role": "procedure|consent|record|general|sterilization|equipment",
    "techniques": ["nome técnico consolidado"],
    "mode": "exact|personalizable|family|new",
    "equivalent": false,
    "uncertain": false,
    "alert": "dúvida objetiva, se houver"
  }],
  "restrictions": [{
    "technique": "nome técnico consolidado",
    "reason": "sem_evidencia|legislacao_desfavoravel|fora_de_habilitacao",
    "detail": "frase objetiva com o motivo"
  }],
  "alerts": ["somente confirmações técnicas objetivas"]
}

Inclua todas as menções relevantes, mesmo as excluídas como produto ou marca. Em coverages, proponha o conjunto mínimo operacional. Para lacuna, use catalogId null e mode new. Não repita documentos equivalentes.`;

  return { systemPrompt, userPrompt };
}
