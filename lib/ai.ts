import Anthropic from "@anthropic-ai/sdk";
import type { DocumentBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import fs from "fs";
import path from "path";

/**
 * Reads ANTHROPIC_API_KEY directly from the .env file.
 * Needed because the inherited shell environment (e.g. Claude Code agent)
 * can override process.env before Next.js loads the .env file.
 */
function readApiKeyFromDotEnv(): string {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

// Lazy singleton — deferred so cwd() is correct at runtime
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const envKey = process.env.ANTHROPIC_API_KEY ?? "";
    const apiKey = envKey.length > 10 ? envKey : readApiKeyFromDotEnv();
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY não encontrada. Verifique o arquivo .env na raiz do projeto."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface ClienteData {
  clienteNomeFantasia?: string;
  clienteRazaoSocial?: string;
  clienteCnpj?: string;
  clienteEndereco?: string;
  clienteCidade?: string;
  clienteEstado?: string;
  clienteEstadoExtenso?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteHorario?: string;
  clienteRtNome?: string;
  clienteRtProfissao?: string;
  clienteRtConselho?: string;
  clienteEstrutura?: string;
  clienteMemorialDescritivoMbp?: string;
  clienteServicos?: Array<string>;
  clienteFuncionarios?: Array<{ nome: string; funcao: string; conselho: string }>;
  clienteEquipamentos?: Array<{ nome: string; marca: string; modelo: string; registro_anvisa: string }>;
  clienteProdutosInsumos?: Array<{ nome: string; categoria: string; fabricante: string; registro_anvisa: string; uso: string }>;
  clienteTerceirizados?: Array<{ servico: string; razao_social: string; cnpj: string }>;
  clienteColetaRazao?: string;
  clienteColetaCnpj?: string;
  clienteResiduosA?: string;
  clienteResiduosD?: string;
  clienteResiduosE?: string;
  documentosAGerar?: Array<{ nome: string; tipo: string }>;
}

export type PdfInput =
  | { type: "pdf_base64"; data: string }
  | { type: "pdf_text"; text: string }
  | { type: "pdf_url"; url: string };

export async function extractClienteData(
  pdfInput: PdfInput,
  elaboracaoText: string
): Promise<{ data: ClienteData; tokensUsados: number }> {
  const systemPrompt = `Você é um assistente que extrai dados estruturados de documentos sanitários brasileiros. Retorne SOMENTE JSON válido, sem markdown, sem explicações.`;

  console.log(
    `[extrair] elaboracaoText length=${elaboracaoText.length}`,
    elaboracaoText.length > 0
      ? `\nPrimeiros 400 chars:\n${elaboracaoText.slice(0, 400)}`
      : "AVISO VAZIO — mammoth não extraiu nada do docx"
  );

  const pdfTextSection =
    pdfInput.type === "pdf_text"
      ? `\nDOCUMENTO 1 — TEXTO EXTRAÍDO DO PDF DO FORMS.APP:\n${pdfInput.text || "(PDF sem texto extraível)"}\n`
      : "";

  const extractPrompt = `O DOCUMENTO 1 ${pdfInput.type === "pdf_text" ? "(texto abaixo)" : "(PDF anexo)"} é o formulário preenchido pelo cliente no forms.app.
O DOCUMENTO 2 (texto abaixo) foi extraído do arquivo .docx "Documentos em Elaboração" do cliente.
${pdfTextSection}

DOCUMENTO 2 — CONTEÚDO EXTRAÍDO DO DOCX:
${elaboracaoText || "(arquivo vazio ou não legível)"}

TAREFA:
1. Extraia os dados do cliente a partir do PDF (DOCUMENTO 1).
2. A partir do DOCUMENTO 2, identifique ABSOLUTAMENTE TODOS os documentos sanitários listados para este cliente.
   REGRAS CRÍTICAS DE EXTRAÇÃO:
   - Extraia CADA linha/item individual — não agrupe, não resuma, não pule nenhum.
   - Considere qualquer item que seja: POP, MBP, Manual, PGRSS, Planilha, Ficha, Termo, Guia, Receituário, TCLE, Checklist, Protocolo, Procedimento, Registro, Formulário, Instrução ou qualquer outro documento técnico/sanitário.
   - O arquivo pode estar em formato de lista, tabela, tópicos, bullets, linhas simples, numerado ou qualquer outro formato — extraia independentemente do formato.
   - Se houver uma lista numerada com 20 itens, retorne 20 entradas no array — não apenas os primeiros.
   - Preserve o nome EXATO do documento como aparece no arquivo (incluindo o número do POP, o procedimento específico, o produto, etc.).
     BOM: "POP de Biossegurança em Procedimentos Estéticos com Agulha"
     RUIM: "POP de Biossegurança" (nome truncado/genérico)
   - Para o campo "tipo", classifique como: MBP, POP, PGRSS, PLANILHA, FICHA, TERMO, GUIA, TCLE ou OUTROS.
   - Se o DOCUMENTO 2 estiver vazio ou ilegível, retorne "documentos_a_gerar" como array vazio [].
   - NUNCA invente documentos que não estejam explicitamente listados no DOCUMENTO 2.

Retorne APENAS um JSON válido com a estrutura abaixo. Use null para campos não encontrados no PDF:

{
  "cliente_nome_fantasia": "",
  "cliente_razao_social": "",
  "cliente_cnpj": "",
  "cliente_endereco": "",
  "cliente_cidade": "",
  "cliente_estado": "",
  "cliente_estado_extenso": "",
  "cliente_telefone": "",
  "cliente_email": "",
  "cliente_horario": "",
  "cliente_rt_nome": "",
  "cliente_rt_profissao": "",
  "cliente_rt_conselho": "",
  "cliente_estrutura_fisica": "",
  "cliente_servicos": [],
  "cliente_equipamentos": [{"nome": "", "marca": "", "modelo": "", "registro_anvisa": ""}],
  "cliente_produtos_insumos": [{"nome": "", "categoria": "", "fabricante": "", "registro_anvisa": "", "uso": ""}],
  "cliente_terceirizados": [{"servico": "", "razao_social": "", "cnpj": ""}],
  "cliente_coleta_razao_social": "",
  "cliente_coleta_cnpj": "",
  "cliente_residuos_grupo_a": "",
  "cliente_residuos_grupo_d": "",
  "cliente_residuos_grupo_e": "",
  "documentos_a_gerar": [{"nome": "", "tipo": ""}]
}`;

  const content =
    pdfInput.type === "pdf_base64"
      ? [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfInput.data },
          } satisfies DocumentBlockParam,
          {
            type: "text" as const,
            text: extractPrompt,
          },
        ]
      : pdfInput.type === "pdf_url"
      ? [
          {
            type: "document",
            source: { type: "url", url: pdfInput.url },
          } satisfies DocumentBlockParam,
          {
            type: "text" as const,
            text: extractPrompt,
          },
        ]
      : [
          {
            type: "text" as const,
            text: extractPrompt,
          },
        ];

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192, // increased: large document lists need more output tokens
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const tokensUsados = response.usage.input_tokens + response.usage.output_tokens;

  console.log(`[extrair] resposta IA (${tokensUsados} tokens):\n${text.slice(0, 800)}`);

  let raw: Record<string, unknown>;
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    raw = JSON.parse(cleaned);
  } catch {
    console.error("[extrair] JSON.parse falhou. Resposta bruta:\n", text);
    raw = {};
  }

  const data: ClienteData = {
    clienteNomeFantasia: (raw.cliente_nome_fantasia as string) || undefined,
    clienteRazaoSocial: (raw.cliente_razao_social as string) || undefined,
    clienteCnpj: (raw.cliente_cnpj as string) || undefined,
    clienteEndereco: (raw.cliente_endereco as string) || undefined,
    clienteCidade: (raw.cliente_cidade as string) || undefined,
    clienteEstado: (raw.cliente_estado as string) || undefined,
    clienteEstadoExtenso: (raw.cliente_estado_extenso as string) || undefined,
    clienteTelefone: (raw.cliente_telefone as string) || undefined,
    clienteEmail: (raw.cliente_email as string) || undefined,
    clienteHorario: (raw.cliente_horario as string) || undefined,
    clienteRtNome: (raw.cliente_rt_nome as string) || undefined,
    clienteRtProfissao: (raw.cliente_rt_profissao as string) || undefined,
    clienteRtConselho: (raw.cliente_rt_conselho as string) || undefined,
    clienteEstrutura: (raw.cliente_estrutura_fisica as string) || undefined,
    clienteServicos: Array.isArray(raw.cliente_servicos) ? (raw.cliente_servicos as string[]) : [],
    clienteEquipamentos: Array.isArray(raw.cliente_equipamentos)
      ? (raw.cliente_equipamentos as ClienteData["clienteEquipamentos"])
      : [],
    clienteProdutosInsumos: Array.isArray(raw.cliente_produtos_insumos)
      ? (raw.cliente_produtos_insumos as ClienteData["clienteProdutosInsumos"])
      : [],
    clienteTerceirizados: Array.isArray(raw.cliente_terceirizados)
      ? (raw.cliente_terceirizados as ClienteData["clienteTerceirizados"])
      : [],
    clienteColetaRazao: (raw.cliente_coleta_razao_social as string) || undefined,
    clienteColetaCnpj: (raw.cliente_coleta_cnpj as string) || undefined,
    clienteResiduosA: (raw.cliente_residuos_grupo_a as string) || undefined,
    clienteResiduosD: (raw.cliente_residuos_grupo_d as string) || undefined,
    clienteResiduosE: (raw.cliente_residuos_grupo_e as string) || undefined,
    documentosAGerar: Array.isArray(raw.documentos_a_gerar)
      ? (raw.documentos_a_gerar as ClienteData["documentosAGerar"])
      : [],
  };

  return { data, tokensUsados };
}

export async function adaptTrecho(
  trechoOriginal: string,
  clienteData: ClienteData,
  modelo?: string
): Promise<{ texto: string; tokensUsados: number }> {
  const equipamentosList =
    clienteData.clienteEquipamentos
      ?.map((e) => `${e.nome} ${e.marca} ${e.modelo} (ANVISA: ${e.registro_anvisa})`)
      .join(", ") || "Não informado";

  const servicosList = clienteData.clienteServicos?.join("; ") || "Nao informado";
  const produtosInsumosList =
    clienteData.clienteProdutosInsumos
      ?.map((p) => [p.nome, p.categoria, p.fabricante, p.registro_anvisa ? `ANVISA ${p.registro_anvisa}` : "", p.uso].filter(Boolean).join(" | "))
      .join("\n") || "Nao informado";
  const funcionariosList =
    clienteData.clienteFuncionarios
      ?.map((f) => `${f.nome} | ${f.funcao}${f.conselho ? ` | ${f.conselho}` : ""}`)
      .join("\n") || "Não informado";

  const systemPrompt = `Você é um especialista em documentos de vigilância sanitária brasileira. Adapte trechos de documentos sanitários mantendo exatamente a mesma estrutura, formatação, tom técnico e nível de detalhe.`;

  const userPrompt = `Adapte o trecho abaixo de um documento sanitário, substituindo os dados do cliente anterior pelo novo cliente. Mantenha EXATAMENTE a mesma estrutura, formatação, tom técnico e nível de detalhe. Não adicione nem remova seções. Não altere legislações, números de RDC ou referências técnicas. Altere apenas: nome do estabelecimento, nome do RT, equipamentos específicos (marcas, modelos, registros ANVISA), serviços realizados, e dados de localização.

DADOS DO NOVO CLIENTE:
- Estabelecimento: ${clienteData.clienteNomeFantasia || ""}
- RT: ${clienteData.clienteRtNome || ""} (${clienteData.clienteRtProfissao || ""})
- Conselho: ${clienteData.clienteRtConselho || ""}
- Cidade/Estado: ${clienteData.clienteCidade || ""}/${clienteData.clienteEstado || ""}
- Equipamentos: ${equipamentosList}
- Produtos, insumos, medicamentos, cosmeticos e ativos:
${produtosInsumosList}
- Funcionários:
${funcionariosList}
- Serviços/procedimentos do cliente (contexto amplo; nao copie a lista inteira): ${servicosList}

TRECHO ORIGINAL (cliente anterior):
${trechoOriginal}

Retorne APENAS o trecho adaptado, sem explicações, sem markdown.`;

  const response = await getClient().messages.create({
    model: modelo || "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const texto = response.content[0].type === "text" ? response.content[0].text : trechoOriginal;
  const tokensUsados = response.usage.input_tokens + response.usage.output_tokens;

  return { texto, tokensUsados };
}

// ─── AI_ADAPT block processing ────────────────────────────────────────────────

export type AdaptBlockType = "instruction" | "content_to_adapt" | "table";

/**
 * Determines if a block contains IA instructions to execute ("instruction"),
 * existing client content to adapt ("content_to_adapt"), or a table request ("table").
 */
export function detectBlockType(blockContent: string): AdaptBlockType {
  // Table request — explicit marker or strong keyword
  if (
    /\[AI_TABLE\]/i.test(blockContent) ||
    /gere?\s+(uma\s+)?tabela/i.test(blockContent) ||
    /monte\s+(uma\s+)?tabela/i.test(blockContent) ||
    /crie\s+(uma\s+)?tabela/i.test(blockContent)
  ) {
    return "table";
  }

  const signals = [
    "Instruções para o sistema",
    "Analise a variável",
    "Gere uma lista",
    "Gere um parágrafo",
    "Escreva a continuação",
    "Redija um parágrafo",
    "Liste apenas",
    "SE SIM",
    "SE NÃO",
    "Se sim",
    "Se não",
    "CENÁRIO A",
    "CENÁRIO B",
    "Cenário A",
    "Cenário B",
    "REGRA:",
    "Regra:",
    "focados em",
    "Apenas se",
    "apenas se",
  ];
  return signals.some((s) => blockContent.includes(s))
    ? "instruction"
    : "content_to_adapt";
}

// ── Cabeçalho de contexto — vai ANTES de tudo
const CONTEXT_HEADER = `
Você está gerando conteúdo para um documento formal de vigilância sanitária.
Seu output vai diretamente para dentro do documento Word — não existe usuário lendo sua resposta.
Não responda, não questione, não peça confirmação, não expresse dúvida.
Gere o texto do documento e nada mais.
Se faltar alguma informação para executar a instrução, faça a melhor escolha possível com o que está disponível.

COMO LER A INSTRUÇÃO DO BLOCO — REGRA CRÍTICA:
A instrução pode conter dados do cliente já resolvidos (listas de serviços, equipamentos,
estrutura física, etc.). Esses dados são CONTEXTO DE REFERÊNCIA para o seu raciocínio —
eles existem para que você entenda o estabelecimento e personalize o texto.

NÃO copie esses dados literalmente no output.
NÃO reproduza listas inteiras de serviços, equipamentos ou estruturas físicas vindas da instrução.
USE esses dados para escrever parágrafos técnicos fluidos e personalizados.

REGRA DE SINTESE OBJETIVA:
Listas longas de servicos, procedimentos, equipamentos, produtos ou estruturas sao CONTEXTO,
nao um roteiro para enumeracao. Use apenas os itens diretamente relevantes para a secao atual.
Quando houver muitos procedimentos semelhantes, agrupe por familia tecnica e escreva a rotina
de forma objetiva, sem transformar o trecho em catalogo completo de atividades.
So enumere todos os itens quando a instrucao pedir explicitamente "liste todos", "inventario",
"relacao completa", "todos os procedimentos" ou uma tabela completa.
Se a instrucao pedir um paragrafo, gere um paragrafo sintetico com ate 4 familias de servico.

Exemplo de instrução:
  "A partir dos serviços [Curativos, Aplicação de injeções, Vacinação], descreva a relação."
Saída ERRADA (cópia literal):
  "1. Curativos  2. Aplicação de injeções  3. Vacinação"
Saída CORRETA (uso como contexto):
  "O estabelecimento realiza execução de curativos simples e complexos com técnica asséptica,
   administração de medicamentos injetáveis e aplicação de vacinas conforme calendário vigente."
`.trim();

// ── Voz / perspectiva
const DOCUMENT_VOICE_RULES = `
VOZ E PERSPECTIVA DO DOCUMENTO:
O documento descreve rotinas que JÁ EXISTEM e SÃO FEITAS no estabelecimento.
Escreva como se a própria Responsável Técnica estivesse descrevendo a rotina estabelecida.
Use voz ativa, presente do indicativo e sujeito operacional claro: "a equipe executa",
"a responsável técnica supervisiona", "o profissional higieniza", "os resíduos permanecem acondicionados".
Nunca use voz passiva burocrática em procedimentos: "é realizado", "são realizados",
"é executado", "são executados", "é feito", "deve ser realizado".
Nunca use futuro do subjuntivo ou tom de obrigação ("deverá ser", "deverão manter") em seções de procedimento.

PROIBIÇÕES ABSOLUTAS DE VOZ:
- NUNCA escreva como avaliador ou auditor de terceiros.
- NUNCA use: "O estabelecimento apresenta...", "Identificamos que...", "Verificou-se que..."
- NUNCA use: "Recomenda-se", "sugere-se", "é necessário que o estabelecimento", "orienta-se"
- NUNCA escreva como promessa, plano futuro ou recomendação. Descreva a rotina atual já implantada.
- NUNCA mencione dados ausentes, variáveis "Não informado", ou limitações de dados.
  Se uma informação não está disponível, use o placeholder [a preencher] e continue.
- NUNCA escreva o seu próprio raciocínio, análise ou processo de pensamento no documento.
- NUNCA escreva "Entendido", "Conforme solicitado", "Baseando-se nas variáveis fornecidas".

PROIBIÇÃO ABSOLUTA DE REFERÊNCIAS (regra crítica):
- NUNCA escreva "REFERÊNCIAS", "REFERÊNCIAS BIBLIOGRÁFICAS", "REFERÊNCIAS NORMATIVAS"
  nem nenhum outro cabeçalho de seção de referências.
- NUNCA liste legislações, RDCs, portarias, resoluções, normas ABNT ou bibliografias
  ao final (ou em qualquer parte) do seu output.
- Sua resposta termina com o último parágrafo de conteúdo. Ponto final.
- O sistema já injeta todas as referências legislativas automaticamente.
- Esta proibição se aplica mesmo que a instrução mencione "referências" —
  neste caso, o ramo de referências será tratado por outro caminho do sistema.

REGRAS DURAS DE BREVIDADE E ESCOPO:
- Seu output é APENAS o conteúdo da seção atual. Nunca gere outras seções, mesmo que pareça relacionado.
- Para a maioria dos blocos, gere de 1 a 2 parágrafos curtos (50–110 palavras cada). Nunca mais que 3 parágrafos.
- Listas: no máximo 6 itens, exceto se a instrução pedir explicitamente "todos os X".
- NUNCA inicie sua resposta com um título de documento. NUNCA termine com "REFERÊNCIAS" ou similar.
- Se seu output passou de 180 palavras e a instrucao nao pediu lista completa ou tabela, PARE.

ESTRUTURA DE SEÇÕES (MUITO IMPORTANTE):
- NUNCA invente títulos novos. O template já tem todos os títulos numerados (1, 2, 2.1, etc.).
- NUNCA escreva títulos como "PLANO DE GERENCIAMENTO DE RESÍDUOS", "RELAÇÃO DE SERVIÇOS", "CLASSIFICAÇÃO E CARACTERÍSTICAS", "GESTÃO DE RESÍDUOS", "DISPOSIÇÕES GERAIS", "ESTRUTURA FÍSICA", "EQUIPAMENTOS", "LEGISLAÇÃO APLICÁVEL", "CARACTERÍSTICAS DOS RESÍDUOS", "TRATAMENTO E DISPOSIÇÃO FINAL", "COLETA E TRANSPORTE", "ARMAZENAMENTO TEMPORÁRIO", "RESPONSABILIDADES E CAPACITAÇÃO", "REFERÊNCIAS".
  Estes títulos JÁ EXISTEM em outras seções do template ou não pertencem aqui.
- NUNCA duplique conteúdo. Se a instrução pede "descreva a segregação", gere UM parágrafo, não um documento sobre segregação.
- NUNCA copie o template de outra seção como exemplo no seu output.
- NUNCA gere uma lista de referências bibliográficas/legislações. Outra seção do template já cuida disso.
- NUNCA gere "Razão Social: X | Nome Fantasia: Y | CNPJ: Z" — esses dados já estão preenchidos pelo template.

TOM E ESPECIFICIDADE:
- Descrições de serviços na Relação de Serviços: gerúndio técnico descritivo, 1 parágrafo curto por categoria.
  BOM: "Execução de consulta de enfermagem contemplando a avaliação clínica sistêmica, anamnese e estruturação do plano terapêutico."
  RUIM: "Realização de consulta." ou "Consulta de enfermagem."
- Descrições de procedimentos no POP: voz ativa institucional com sujeito operacional claro.
  BOM: "O profissional acomoda o paciente na maca, higieniza as mãos e calça as luvas."
  RUIM: "O paciente é acomodado na maca", "Deve-se acomodar o paciente" ou "Recomenda-se que o profissional higienize as mãos."
- Descrições no PGRSS: descreva o que ocorre, não o que deveria ocorrer.
  BOM: "A equipe acondiciona os resíduos do Grupo A em lixeiras com acionamento por pedal..."
  RUIM: "Os resíduos do Grupo A devem ser acondicionados..."

QUANDO DADOS ESTÃO AUSENTES:
- Equipamentos não informados: escreva genericamente compatível com o tipo de clínica.
  Não escreva "o estabelecimento não informou equipamentos".
- Empresa de coleta não informada: deixe [a preencher] como placeholder.
- Horário não informado: use "mediante agendamento prévio".
- Estimativa de resíduos com valor numérico bruto (ex: "1"): assuma kg/mês e formate como "aproximadamente 1 kg/mês".

REGRA CRÍTICA — AUSÊNCIA DE DADOS DO PROFISSIONAL:
- NUNCA escreva "não possui conselho de classe", "sem registro no conselho", "não tem CRM",
  "não tem COREN", "não possui registro profissional" ou qualquer variante.
- NUNCA declare a ausência de uma credencial profissional no texto do documento.
- Se o conselho do RT não foi informado: use [a preencher] se necessário, ou simplesmente
  redija a frase sem mencionar o conselho. Exemplo correto: "sob responsabilidade técnica de
  Dra. Maria Silva, Enfermeira." — sem mencionar conselho se não há dado.
- Esta regra se aplica a QUALQUER dado de credencial: conselho, CRM, CRO, COREN, CRF, CREFITO etc.

PROIBIÇÃO DE LEGISLAÇÕES INVENTADAS:
- NUNCA escreva RDC, Portaria, Resolução, Lei ou norma com número e data específicos
  sem ter certeza absoluta de que tal norma existe com exatamente esse número e data.
- Para regulamentação profissional de categorias menos comuns (tecnólogo em estética,
  cosmetólogo, etc.), use APENAS: "legislação federal vigente" ou "normativa regulatória
  aplicável" — genérico, sem número ou data.
- Esta proibição é especialmente crítica: uma referência inventada é PIOR do que nenhuma.
- Se a instrução pede regulamentação do conselho de classe e você não tem certeza: não invente.

REGRA ANTI-ENUMERAÇÃO:
- NUNCA construa uma frase longa enumerando individualmente todos os serviços, procedimentos
  ou equipamentos do cliente. Isso produz textos ilegíveis e não é o estilo técnico correto.
- RUIM: "O estabelecimento realiza procedimentos estéticos faciais, corporais, laser de alta
  potência, radiofrequência, ultrassom focalizado, harmonização orofacial, micropigmentação..."
- BOM: "O estabelecimento atua na área de estética avançada, oferecendo procedimentos
  não cirúrgicos com foco em bem-estar e segurança do paciente."
- Quando a instrução pede "2 frases" ou "parágrafo curto": respeite o limite estritamente.
  Máximo 30 palavras por frase. Se vai exceder, corte — prefira síntese a completude.
`.trim();

const FEW_SHOT_RELACAO_SERVICOS = `
EXEMPLOS DE COMO DESCREVER SERVIÇOS:

EXEMPLO CORRETO (nível de detalhe esperado):
"Execução de punção venosa periférica para a administração segura de soroterapia intravenosa,
com rigoroso controle de compatibilidade de vitaminas e nutrientes.
Administração de medicamentos injetáveis básicos por vias intramuscular, subcutânea e intravenosa,
garantindo a técnica asséptica."

EXEMPLO INCORRETO:
"Terapia injetável (administração de medicamentos: EV, IM, SC, ID, VO)"
→ Muito breve, sem descrição técnica.

EXEMPLO INCORRETO:
"O estabelecimento realiza terapia injetável que inclui administração de medicamentos."
→ Vago, sem verbos técnicos descritivos.
`.trim();

const FEW_SHOT_PGRSS_SEGREGACAO = `
EXEMPLO CORRETO para seção de segregação (UM parágrafo, sem subtítulos):
"A equipe executa a segregação na própria sala de atendimento, na recepção, no banheiro e no DML.
A equipe descarta os materiais perfurocortantes (Grupo E) e infectantes (Grupo A)
imediatamente após o uso, minimizando a manipulação e o risco de acidentes.
A equipe separa os resíduos recicláveis limpos (Grupo D) dos resíduos comuns de varrição na origem.
A rotina proíbe a transferência de resíduos entre recipientes, o esvaziamento, a compactação
ou o reaproveitamento de recipientes que já contenham resíduos dos Grupos A e E."

EXEMPLO INCORRETO (NUNCA FAÇA ISSO):
"GESTÃO DE RESÍDUOS DE SERVIÇOS DE SAÚDE
SEGREGAÇÃO DE RESÍDUOS
A segregação ocorre nas áreas técnicas, compreendendo:
• Recepção
• Salas de consultório
DESCARTE DE MATERIAIS INFECTANTES E PERFUROCORTANTES
A equipe descarta imediatamente após o uso..."
→ Inventou subtítulos. Inventou bullets. Duplicou conteúdo. NUNCA faça assim.
`.trim();

const AI_OUTPUT_RULES = `
REGRAS ABSOLUTAS DE SAÍDA:
- NUNCA use markdown. Proibido **, *, ##, >, _, \`\`\` e qualquer outra sintaxe markdown.
- Retorne APENAS texto puro com quebras de linha simples (\\n) para separar itens.
- Para indicar título de seção: escreva em CAIXA ALTA sem nenhum marcador.
- NUNCA use os caracteres { ou } no seu output. Use [ ou ] no lugar.
- NUNCA use hífen (-) como marcador de lista.
- NÃO inclua linhas em branco entre itens de lista numerada ou bullets — coloque-os diretamente um após o outro.
- PROIBIÇÃO ABSOLUTA DE TRAVESSÃO: NUNCA use travessão (—) nem meia-risca (–) em nenhuma hipótese.
  Use vírgula (,), ponto-e-vírgula (;) ou dois-pontos (:) no lugar.
  O único hífen permitido é o hífen gramatical de palavras compostas (ex: "pré-operatório", "guarda-roupa").
  Esta regra não tem exceções — nem em citações, nem em aposto, nem em enumerações.

REGRA CRÍTICA DE FORMATAÇÃO DE LISTAS:
Quando a instrução do bloco especificar o formato a usar, você DEVE obedecer exatamente:

  SE a instrução pede "lista numerada", "passos", "etapas" ou "passo a passo":
    → Use numeração: cada passo em sua própria linha, começando por "1. ", "2. ", "3. " etc.
    → NUNCA transforme passos numerados em parágrafos contínuos.
    → NÃO deixe linha em branco entre os passos.
    → Exemplo correto:
        1. Higienize as mãos com água e sabão por 20 segundos.
        2. Calce as luvas de procedimento estéreis.
        3. Posicione o paciente na maca em decúbito dorsal.

  SE a instrução pede "bullets", "tópicos" ou "lista de itens":
    → Use bullet Unicode: cada item em sua própria linha, começando por "• ".
    → NUNCA use hífen (-) no lugar do bullet.
    → NÃO deixe linha em branco entre os bullets.
    → Exemplo correto:
        • EPI: luvas, máscara cirúrgica, avental descartável.
        • Materiais de limpeza: álcool 70%, pano de microfibra, balde identificado.

  SE a instrução pede "parágrafo" ou "texto corrido":
    → Escreva em prosa contínua, SEM lista, SEM bullets, SEM numeração.

  SE a instrução NÃO especifica o formato:
    → Passos sequenciais de procedimento: use lista numerada.
    → Itens sem ordem obrigatória: use bullets.
    → Descrições de contexto, objetivo, finalidade: use parágrafo.
`.trim();

const FORMATTING_RULES = `
REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
- Títulos Nível 1: NEGRITO + CAIXA ALTA
- Títulos Nível 2: CAIXA ALTA sem negrito
- Títulos Nível 3: Negrito caixa baixa
- Negrito: apenas em títulos ou pontos-chave (legislações, termos técnicos críticos)
- Passos com sequência lógica: numeração (1, 2, 3...)
- Listas de materiais sem ordem obrigatória: bullets
- Proibido colocar títulos dentro de bullets ou listas
- Proibido emojis em documentos formais
- Sem espaçamento extra entre itens de lista
`.trim();

const ABNT_FORMAT = `
FORMATO ABNT PARA REFERÊNCIAS:
- Legislação: BRASIL. Órgão. Resolução nº X, de DD de mês de AAAA. Ementa. Local, AAAA. Disponível em: [URL].
- Sem "Acesso em" para legislação (é documento permanente)
- Não repetir referências já existentes no documento
- Reutilizar referências validadas de outras seções do mesmo documento
`.trim();

/**
 * Prompt especializado ativado SOMENTE quando o bloco AI_ADAPT é detectado
 * como sendo uma seção de referências bibliográficas.
 * Neste modo a IA deve APENAS retornar entradas ABNT adicionais (uma por linha),
 * sem criar cabeçalho de seção — o cabeçalho já existe no template.
 */
const REFERENCE_MODE_RULES = `
MODO REFERÊNCIAS — INSTRUÇÕES EXCLUSIVAS PARA ESTE BLOCO:
Você está adicionando entradas a uma lista de referências já existente no documento.
As legislações gerais de vigilância sanitária (RDC ANVISA, Portarias MS, Lei nº 6.360 etc.)
JÁ ESTÃO incluídas automaticamente pelo sistema via variável interna — não as repita.

Adicione APENAS referências que sejam ESPECÍFICAS desta seção:
normas ABNT de produto, manuais técnicos de fabricante, regulamentações de conselhos
profissionais ou documentos técnicos não cobertos pelas legislações gerais.

Se não houver referências específicas a adicionar, retorne exatamente: (sem referências adicionais)

REGRAS ABSOLUTAS DE FORMATO:
- Uma referência por linha, parágrafo simples, sem nenhum marcador antes do texto.
- NÃO use bullets (•), hífens (-), asteriscos (*) nem qualquer símbolo de lista.
  Cada referência começa DIRETAMENTE pela autoria: "BRASIL. ..." ou "ABNT. ..."
- NÃO numere as referências.
- NÃO escreva "REFERÊNCIAS:", "REFERÊNCIAS BIBLIOGRÁFICAS:" nem nenhum cabeçalho.
- NÃO invente URLs. Se não souber a URL exata, OMITA completamente o trecho "Disponível em: ...".
  O campo de URL será preenchido manualmente quando necessário.
- NÃO adicione explicação, comentário ou texto de transição.

Modelos de formato correto (sem marcadores, começando direto pela autoria):
BRASIL. Agência Nacional de Vigilância Sanitária. Resolução RDC nº X, de DD de mês de AAAA. Ementa. Brasília, AAAA.
ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. NBR XXXXX: título da norma. Rio de Janeiro, AAAA.
`.trim();

/**
 * Returns true if the block instruction is requesting bibliographic references,
 * triggering the specialized REFERENCE_MODE_RULES prompt path.
 */
function isReferenceInstruction(instruction: string): boolean {
  return /referên|referencia|bibliograf|ABNT\s*\d|norma\s+técnica|lista\s+de\s+legisla/i.test(
    instruction
  );
}

/**
 * Returns true when the block instruction is asking for a list of siglas/acronyms.
 * Triggers injection of the sigla exclusion list into the prompt so the AI
 * doesn't repeat siglas already present in the template.
 */
function isSiglasInstruction(instruction: string): boolean {
  return /\bsiglas?\b|\babreviatur|\bacrônimo/i.test(instruction);
}

/**
 * Post-processes AI output to strip any REFERÊNCIAS section header or
 * full bibliography block the model may have generated despite instructions.
 *
 * @param texto      Raw AI output text.
 * @param isRefBlock Whether this was a reference-mode block.
 *                   - true  → strip only the heading, keep the ABNT entries.
 *                   - false → strip the heading AND all content after it.
 */
function stripSpuriousReferences(texto: string, isRefBlock: boolean): string {
  const headingPattern =
    /\n?(REFERÊNCIAS|REFERÊNCIAS BIBLIOGRÁFICAS|REFERÊNCIAS NORMATIVAS|REFERÊNCIAS TÉCNICAS|REFERÊNCIAS E BIBLIOGRAFIA)[^\n]*\n?/i;

  if (isRefBlock) {
    // 1. Remove any spurious heading line the AI inserted
    let result = texto.replace(headingPattern, "\n").trim();

    // 2. Strip leading bullet/list markers from each reference line.
    //    The AI sometimes uses "• BRASIL. ..." or "- BRASIL. ..." despite instructions.
    result = result
      .split("\n")
      .map((line) => line.replace(/^[\s]*[•\-\*]\s+/, "").trimStart())
      .join("\n");

    // 3. Remove numbered list markers: "1. BRASIL. ..." → "BRASIL. ..."
    result = result.replace(/^\d+\.\s+/gm, "");

    return result.trim();
  }

  // Non-reference block: strip heading AND everything that follows it
  // (the AI tends to append the whole bibliography at the very end)
  return texto
    .replace(/\n?(REFERÊNCIAS|REFERÊNCIAS BIBLIOGRÁFICAS|REFERÊNCIAS NORMATIVAS|REFERÊNCIAS TÉCNICAS|REFERÊNCIAS E BIBLIOGRAFIA)[\s\S]*/i, "")
    .trim();
}

/**
 * Processes a single AI_ADAPT block.
 *
 * - "instruction" blocks: AI executes the directives and generates new content.
 *   - Sub-case "reference": instruction requests ABNT references → specialized prompt.
 * - "content_to_adapt" blocks: AI swaps old client data for the new one.
 * - "table" blocks: AI returns JSON describing a table → caller renders OOXML.
 *
 * For "table" blocks the returned `texto` is a JSON string of the form:
 *   {"headers":["col1","col2"],"rows":[["a","b"],["c","d"]]}
 * The generator detects this and converts it into a <w:tbl> element.
 */
export async function processAdaptBlock(
  instruction: string,
  clienteData: ClienteData,
  blockType: AdaptBlockType,
  modelo?: string
): Promise<{ texto: string; tokensUsados: number }> {
  const equipamentosList =
    clienteData.clienteEquipamentos
      ?.map((e) => `${e.nome} | ${e.marca} | ${e.modelo} | ANVISA ${e.registro_anvisa}`)
      .join("\n") || "Não informado";

  const servicosList = clienteData.clienteServicos?.join("; ") || "Nao informado";
  const produtosInsumosList =
    clienteData.clienteProdutosInsumos
      ?.map((p) => [p.nome, p.categoria, p.fabricante, p.registro_anvisa ? `ANVISA ${p.registro_anvisa}` : "", p.uso].filter(Boolean).join(" | "))
      .join("\n") || "Nao informado";
  const funcionariosList =
    clienteData.clienteFuncionarios
      ?.map((f) => `${f.nome} | ${f.funcao}${f.conselho ? ` | ${f.conselho}` : ""}`)
      .join("\n") || "Não informado";

  const clienteContext = [
    `Nome fantasia: ${clienteData.clienteNomeFantasia || ""}`,
    `Razão social: ${clienteData.clienteRazaoSocial || ""}`,
    `Cidade/Estado: ${clienteData.clienteCidade || ""}/${clienteData.clienteEstado || ""}`,
    `RT: ${clienteData.clienteRtNome || ""} (${clienteData.clienteRtProfissao || ""})`,
    // Omit conselho line entirely when absent — prevents AI from writing "não possui conselho"
    clienteData.clienteRtConselho
      ? `Conselho do RT: ${clienteData.clienteRtConselho}`
      : `Conselho do RT: (não informado — SE necessário no texto, use [a preencher], NUNCA escreva "não possui")`,
    `Estrutura física: ${clienteData.clienteEstrutura || ""}`,
    `Memorial descritivo do MBP: ${clienteData.clienteMemorialDescritivoMbp || ""}`,
    `Funcionários:\n${funcionariosList}`,
    `Equipamentos:\n${equipamentosList}`,
    `Produtos, insumos, medicamentos, cosmeticos e ativos:\n${produtosInsumosList}`,
    `Servicos/procedimentos (contexto amplo; nao copiar integralmente): ${servicosList}`,
  ].join("\n");

  let userPrompt: string;
  let maxTokens = 2048;

  // Detect if this instruction block is specifically requesting ABNT references
  const isRefBlock =
    blockType === "instruction" && isReferenceInstruction(instruction);

  // Sigla exclusion — injected when block is asking for acronym/sigla list
  const siglasBlock =
    blockType === "instruction" && isSiglasInstruction(instruction);
  const siglasExclusion = siglasBlock
    ? `\n\nSIGLAS JÁ PRESENTES NO DOCUMENTO — NÃO REPETIR:\nANVISA, CME, EPI, MBP, PGRSS, POP, TCLE, DML, RT, RSS, SESMT, CIPA, PCI, PSP, PCMSO, NR, CNS, SUS, VISA.\nGere SOMENTE siglas específicas do contexto deste cliente que NÃO estejam na lista acima.\nSe não houver siglas novas, retorne EXATAMENTE (sem siglas adicionais)`
    : "";

  if (blockType === "table") {
    // Specialized prompt for tables — AI returns JSON only
    maxTokens = 3072;
    userPrompt = `${CONTEXT_HEADER}

Sua tarefa: gerar o conteúdo de UMA tabela em formato JSON estrito.

REGRAS:
- Retorne APENAS um JSON válido, nada mais. Sem markdown, sem explicação.
- Estrutura: {"headers": ["Col1", "Col2", ...], "rows": [["v1","v2",...], ["v1","v2",...]]}
- Cada linha de "rows" deve ter o mesmo número de células que "headers".
- Use texto puro nas células (sem markdown, sem { } ).
- Se faltar dado, use "[a preencher]" como valor de célula.

DADOS DO ESTABELECIMENTO:
${clienteContext}

INSTRUÇÃO DO BLOCO:
${instruction}

Retorne APENAS o JSON.`;
  } else if (isRefBlock) {
    // ── Modo Referência: prompt especializado, sem as regras gerais de conteúdo
    maxTokens = 1024;
    userPrompt = `${CONTEXT_HEADER}

${REFERENCE_MODE_RULES}

DADOS DO ESTABELECIMENTO:
${clienteContext}

INSTRUÇÃO DO BLOCO DE REFERÊNCIAS:
${instruction}`;
  } else if (blockType === "instruction") {
    userPrompt = `${CONTEXT_HEADER}

${AI_OUTPUT_RULES}

${FORMATTING_RULES}

${ABNT_FORMAT}

${DOCUMENT_VOICE_RULES}

${FEW_SHOT_RELACAO_SERVICOS}

${FEW_SHOT_PGRSS_SEGREGACAO}

DADOS DO ESTABELECIMENTO:
${clienteContext}

INSTRUÇÃO A EXECUTAR:
${instruction}${siglasExclusion}

REGRAS DE EXECUÇÃO:
- Retorne APENAS o texto gerado, sem repetir a instrução, sem explicações.
- Tom técnico e formal (documento sanitário oficial).
- META DE TAMANHO: 80 a 180 palavras para texto corrido. So passe disso quando a instrucao pedir lista completa, tabela ou passo a passo essencial.
- Em instruções condicionais (SE SIM / SE NÃO, CENÁRIO A / B): execute APENAS o ramo que se aplica.
- Se a instrução indicar "retorne vazio" ou o estabelecimento não se enquadrar: retorne string vazia.
- Dados do cliente que aparecem NA INSTRUÇÃO (listas, nomes, estruturas) são contexto de raciocínio.
  Transforme-os em texto corrido técnico — nunca os liste ou copie de volta no output.
- Quando a instrucao citar muitos procedimentos do cliente, selecione somente os grupos relevantes
  para a secao atual. Prefira sintese tecnica objetiva a enumeracao completa.
- Nunca escreva uma frase-catálogo com mais de 6 procedimentos separados por virgulas.`;
  } else {
    userPrompt = `${CONTEXT_HEADER}

${AI_OUTPUT_RULES}

${FORMATTING_RULES}

${ABNT_FORMAT}

${DOCUMENT_VOICE_RULES}

${FEW_SHOT_RELACAO_SERVICOS}

${FEW_SHOT_PGRSS_SEGREGACAO}

Adapte o trecho abaixo substituindo os dados do cliente anterior pelos dados do novo cliente.
Mantenha EXATAMENTE a mesma estrutura e nível de detalhe.
Não adicione nem remova seções. Não altere legislações, RDCs ou referências técnicas.
Altere apenas: nomes, RT, equipamentos (marcas/modelos/ANVISA), serviços e localização.
Ao adaptar serviços/procedimentos, não despeje a lista completa do novo cliente no texto.
Use síntese por famílias técnicas e mantenha somente o que for relevante para este trecho.

DADOS DO NOVO CLIENTE:
${clienteContext}

TRECHO ORIGINAL:
${instruction}

LIMITE: o texto adaptado tem aproximadamente o MESMO tamanho do trecho original. NUNCA o dobro.
Se o trecho original for uma enumeração longa de procedimentos, substitua por texto técnico mais sintético,
preservando a função da seção sem listar todos os procedimentos.

Retorne APENAS o trecho adaptado, sem explicações.`;
  }

  const response = await getClient().messages.create({
    model: modelo || "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: "Você é um especialista em documentos de vigilância sanitária brasileira.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawTexto =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const tokensUsados = response.usage.input_tokens + response.usage.output_tokens;

  // ── Post-processing ──────────────────────────────────────────────────────

  // 1. Strip any REFERÊNCIAS header/section the AI may have generated.
  //    For reference blocks → keep entries, strip heading only.
  //    For all other blocks → strip heading + all content after it.
  let texto = stripSpuriousReferences(rawTexto, isRefBlock);

  // 2. Replace em-dashes (—) and en-dashes (–) with context-aware punctuation.
  //    These never belong in formal sanitária documents and break the style guide.
  //    We replace " — " (with spaces) with ": ", bare "—" at line/sentence start
  //    with nothing, and remaining occurrences with ", ".
  texto = texto
    .replace(/\s+—\s+/g, ": ")   // em-dash surrounded by spaces → colon
    .replace(/\s+–\s+/g, ", ")   // en-dash surrounded by spaces → comma
    .replace(/—/g, ", ")          // bare em-dash → comma
    .replace(/–/g, "-");          // bare en-dash → regular hyphen (word compounds)

  // 3. Strip any remaining AI refusal / meta-commentary lines that slipped through.
  //    Lines starting with these patterns are dropped entirely.
  texto = texto
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true; // keep blank lines (spacing)
      if (/^não\s+(posso|consigo)/i.test(t)) return false;
      if (/^desculpe[,\s]/i.test(t)) return false;
      if (/^lamento[,\s]/i.test(t)) return false;
      if (/^a\s+solicitação\s+pede/i.test(t)) return false;
      if (/^(esta\s+instrução|a\s+instrução|o\s+bloco)/i.test(t)) return false;
      if (/^I\s+(cannot|can't|am\s+unable)/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();

  return { texto, tokensUsados };
}
