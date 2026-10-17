import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages/messages";
import { EXEMPLOS_PLANEJAMENTOS, ROTULOS_IDENTIFICACAO, ROTULOS_TERCEIRIZADOS } from "./exemplos";
import { REGRAS_SKILL } from "./regras-skill";
import { GRUPOS_REFERENCIAS, SECAO_ASSISTENCIAL, SECAO_FICHAS, SECAO_INSTITUCIONAL, SECAO_PLANILHAS, SECAO_ROTINAS, SECAO_TCLES, SECOES_DE_PROCEDIMENTO } from "./regras";
import type { CandidataReferencia } from "./referencias";
import type { AtividadeCnae, CampoRotulado, EquipamentoPlanejado, InsumoPlanejado, LinhaMatriz } from "./tipos";

// As duas leituras da IA no planejamento: (1) o formulário vira o rascunho do
// documento, com os documentos escolhidos do acervo; (2) as referências escolhidas
// do banco VISA Legislação. As regras fixas e o texto ABNT ficam fora da IA.

const MODELO = process.env.PLANEJAMENTO_MODELO || "claude-opus-5-5";

// Do "Regras confirmadas pela usuária" até o fim do SKILL.md (base normativa verificada).
// A escolha de referências só recebia o arquivo de normas e deixava a RDC 50/2002 de fora.
const NORMAS_DO_SKILL = (() => {
  const inicio = REGRAS_SKILL.indexOf("## Regras confirmadas pela usuária");
  const fim = REGRAS_SKILL.indexOf("<<<ARQUIVO", inicio);
  return inicio < 0 ? "" : REGRAS_SKILL.slice(inicio, fim < 0 ? undefined : fim);
})();

/** Igual a lib/ai.ts: o shell de quem roda o app local pode sobrescrever a chave do .env. */
function chaveDaApi(): string {
  const doAmbiente = process.env.ANTHROPIC_API_KEY ?? "";
  if (doAmbiente.length > 10) return doAmbiente;
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    return env.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1].trim() ?? "";
  } catch {
    return "";
  }
}

function cliente(): Anthropic {
  const apiKey = chaveDaApi();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  // A função da Vercel tem 300 s; a leitura do formulário cabe com folga em 270 s.
  return new Anthropic({ apiKey, timeout: 270_000, maxRetries: 1 });
}

async function chamarFerramenta<T>(params: {
  sistema: string;
  conteudo: Anthropic.Messages.ContentBlockParam[];
  ferramenta: Tool;
  maxTokens: number;
}): Promise<{ dados: T; tokens: number }> {
  const stream = cliente().messages.stream({
    model: MODELO,
    max_tokens: params.maxTokens,
    system: [{ type: "text", text: params.sistema, cache_control: { type: "ephemeral" } }],
    tools: [params.ferramenta],
    // O Opus 5.5 não aceita ferramenta obrigatória ("tool"/"any"): a instrução pede a chamada.
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: [
          ...params.conteudo,
          { type: "text", text: `Responda chamando a ferramenta ${params.ferramenta.name}, sem texto fora dela.` },
        ],
      },
    ],
  });
  const resposta = await stream.finalMessage();
  console.info(
    `[planejamento] ${params.ferramenta.name}: entrada ${resposta.usage.input_tokens}, saída ${resposta.usage.output_tokens}, fim ${resposta.stop_reason}`
  );
  const bloco = resposta.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") throw new Error("A IA não devolveu o planejamento. Tente de novo.");
  if (resposta.stop_reason === "max_tokens") {
    throw new Error("A resposta da IA ficou grande demais e foi cortada. Tente de novo.");
  }
  return {
    dados: bloco.input as T,
    tokens: resposta.usage.input_tokens + resposta.usage.output_tokens,
  };
}

// ── 1. Formulário → rascunho ────────────────────────────────────────────────

export interface TemplateCatalogo {
  id: string;
  nome: string;
  tipo: string;
}

export interface ItemDocumentoIa {
  nome: string;
  /** id do template do acervo (T001...) que sustenta o item; null = sem template seguro. */
  template: string | null;
}

export interface Pendencia {
  assunto: string;
  detalhe: string;
  /** "cliente": perguntar à cliente; "ester": decisão da consultora. */
  para: "cliente" | "ester";
}

export interface RascunhoIa {
  formularioIntegro: boolean;
  avisoFormulario: string;
  servicoDeSaude: boolean;
  nomeCliente: string;
  cidade: string;
  uf: string;
  introducao: string;
  identificacao: CampoRotulado[];
  estruturaFisica: string[];
  terceirizados: CampoRotulado[];
  procedimentos: string[];
  secoes: Array<{ titulo: string; itens: ItemDocumentoIa[] }>;
  equipamentos: EquipamentoPlanejado[];
  insumos: InsumoPlanejado[];
  matriz: LinhaMatriz[];
  cnaes: AtividadeCnae[];
  profissoes: string[];
  pendencias: Pendencia[];
}

const campoRotulado = {
  type: "object",
  properties: { rotulo: { type: "string" }, valor: { type: "string" } },
  required: ["rotulo", "valor"],
} as const;

const FERRAMENTA_RASCUNHO: Tool = {
  name: "registrar_planejamento",
  description: "Registra o rascunho do Documentos em Elaboração montado a partir do formulário da cliente.",
  input_schema: {
    type: "object",
    properties: {
      formularioIntegro: { type: "boolean", description: "false se alguma página estiver cortada ou ilegível." },
      avisoFormulario: { type: "string", description: "O que está cortado/ilegível e onde; vazio se íntegro." },
      servicoDeSaude: {
        type: "boolean",
        description: "true quando há profissional de saúde com conselho (médico, enfermagem, fisioterapia, farmácia, biomedicina, nutrição, odontologia etc.) atendendo pacientes.",
      },
      nomeCliente: { type: "string", description: "Nome fantasia; sem ele, o nome da titular." },
      cidade: { type: "string" },
      uf: { type: "string", description: "Sigla da UF." },
      introducao: { type: "string" },
      identificacao: { type: "array", items: campoRotulado },
      estruturaFisica: { type: "array", items: { type: "string" }, description: "Parágrafos." },
      terceirizados: { type: "array", items: campoRotulado },
      procedimentos: { type: "array", items: { type: "string" } },
      secoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  template: { type: ["string", "null"], description: "id T### do acervo ou null." },
                },
                required: ["nome", "template"],
              },
            },
          },
          required: ["titulo", "itens"],
        },
      },
      equipamentos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            nome: { type: "string" },
            marca: { type: "string" },
            serie: { type: "string" },
            registroAnvisa: { type: "string" },
          },
          required: ["id", "nome", "marca", "serie", "registroAnvisa"],
        },
      },
      insumos: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, nome: { type: "string" }, marca: { type: "string" } },
          required: ["id", "nome", "marca"],
        },
      },
      matriz: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            procedimento: { type: "string" },
            equipamentos: { type: "string" },
            insumos: { type: "string" },
          },
          required: ["id", "procedimento", "equipamentos"],
        },
      },
      cnaes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["Principal", "Secundária"] },
            codigo: { type: "string" },
            descricao: { type: "string" },
          },
          required: ["tipo", "codigo", "descricao"],
        },
      },
      profissoes: {
        type: "array",
        items: { type: "string" },
        description: "Categorias profissionais da equipe que executa os procedimentos (ex.: fisioterapia, enfermagem, farmácia, medicina, biomedicina, estética).",
      },
      pendencias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            assunto: { type: "string" },
            detalhe: { type: "string" },
            para: { type: "string", enum: ["cliente", "ester"] },
          },
          required: ["assunto", "detalhe", "para"],
        },
      },
    },
    required: [
      "formularioIntegro",
      "avisoFormulario",
      "servicoDeSaude",
      "nomeCliente",
      "cidade",
      "uf",
      "introducao",
      "identificacao",
      "estruturaFisica",
      "terceirizados",
      "procedimentos",
      "secoes",
      "equipamentos",
      "insumos",
      "matriz",
      "cnaes",
      "profissoes",
      "pendencias",
    ],
  },
};

const SISTEMA_RASCUNHO = `Você monta o "Documentos em Elaboração" (planejamento da Pasta Sanitária 100% Personalizada) da consultoria TreinaVISA, da Ester, a partir do formulário da cliente (PDF do forms.app) e dos demais arquivos que ela mandou (PDFs, fotos, documentos, mensagens). Escreva em português do Brasil.

As regras da Ester estão na skill abaixo. Siga-as integralmente, com estas adaptações ao app:
- Não há pastas, scripts nem ferramentas de arquivo aqui: ignore as instruções sobre conectar pastas, rodar scripts, montar ou renderizar DOCX e gravar arquivos. O app monta o DOCX.
- O acervo de templates vem na mensagem como lista "T### | nome | tipo". Ele é a autoridade dos nomes. Cada item de documento leva o id do template que o sustenta; se nenhum template cobre a técnica com segurança, use template null e registre uma pendência para a Ester.
- Nomes dos itens: siga a grafia dos planejamentos recentes (exemplos abaixo), com hífen simples: "POP - Nome", "TCLE - Nome". Fichas, planilhas, registros e termos no estilo "Ficha de ...", "Folha de ...", "Planilha de ...", "Registro de ...", "Termo de ...", "Formulário de ...". Não invente variante quando o exemplo já tem o nome do mesmo documento.
- Legislação NÃO é com você: não escreva referências. Elas vêm do banco de normas em outra etapa.
- Pendências, perguntas, lacunas e decisões vão no campo "pendencias", nunca no texto do documento. Nada de "???", "a confirmar" ou "não informado" nos campos: campo sem dado fica com valor vazio.
- Integridade do formulário: se alguma linha começar no meio de palavra ou a página estiver cortada, marque formularioIntegro=false, explique em avisoFormulario e não deduza o trecho perdido.

Seções de documentos, nesta ordem, só as que tiverem itens:
1. "${SECAO_INSTITUCIONAL}"
2. "${SECAO_ROTINAS}"
3. "${SECAO_ASSISTENCIAL}"
4. Grupos de POPs de procedimento, com um destes títulos: ${SECOES_DE_PROCEDIMENTO.map((t) => `"${t}"`).join(", ")}
5. "${SECAO_FICHAS}"
6. "${SECAO_TCLES}"
7. "${SECAO_PLANILHAS}"
Sem algarismo romano no título (o app numera).

Campos de identificação: use estes rótulos, nesta ordem, só os que se aplicam (Versão da Pasta, Plataforma e Cor da logomarca o app põe sozinho): ${ROTULOS_IDENTIFICACAO.join("; ")}.
Serviços terceirizados: rótulos usuais ${ROTULOS_TERCEIRIZADOS.join("; ")}. Serviço não contratado fica com valor vazio; esterilização não realizada no local é descrita objetivamente.
Equipamentos E01, E02...; insumos I01, I02... (só os informados nominalmente); matriz P01, P02... uma linha por procedimento consolidado, com os ids dos equipamentos ("Equipamento NÃO INFORMADO" ou "Não se aplica" quando for o caso).
CNAEs só quando o formulário trouxer cartão CNPJ ou lista de atividades.

Introdução: use a fórmula estável da skill, citando só os elementos que existem (formulário, fotografias, dados do CNPJ).

=== PLANEJAMENTOS RECENTES (estrutura e grafia a seguir; os documentos variam com a cliente) ===
${EXEMPLOS_PLANEJAMENTOS}

=== SKILL DA ESTER ===
${REGRAS_SKILL}`;

export async function lerFormulario(params: {
  /** Blocos de lib/planejamento/anexos.ts: formulário, outros PDFs, fotos, Word e texto. */
  anexos: Anthropic.Messages.ContentBlockParam[];
  templates: TemplateCatalogo[];
  observacoes?: string;
}): Promise<{ rascunho: RascunhoIa; tokens: number }> {
  const catalogo = params.templates.map((t) => `${t.id} | ${t.nome} | ${t.tipo}`).join("\n");
  const partes = [
    "Os arquivos acima são tudo o que a cliente mandou: o formulário do forms.app e, às vezes, outros documentos, fotos e mensagens com informações que não estão no formulário. Junte tudo; quando dois arquivos divergirem, registre pendência.",
    `ACERVO DE TEMPLATES (${params.templates.length}):\n${catalogo}`,
  ];
  if (params.observacoes?.trim()) {
    partes.push(
      `INFORMAÇÕES COLADAS PELA ESTER (fonte mais recente, prevalece sobre os arquivos):\n${params.observacoes.trim()}`
    );
  }
  partes.push("Monte o planejamento desta cliente e registre com a ferramenta.");

  const { dados, tokens } = await chamarFerramenta<RascunhoIa>({
    sistema: SISTEMA_RASCUNHO,
    // O raciocínio do Opus 5.5 (sempre ligado) sai do mesmo teto: com Forms grande e
    // muitas fotos, 20000 cortava o planejamento no meio.
    maxTokens: 64000,
    ferramenta: FERRAMENTA_RASCUNHO,
    conteudo: [...params.anexos, { type: "text", text: partes.join("\n\n") }],
  });
  return { rascunho: dados, tokens };
}

// ── 2. Referências do banco ─────────────────────────────────────────────────

export interface EscolhaReferencias {
  grupos: Array<{ titulo: string; ids: string[] }>;
  pendencias: Pendencia[];
}

const FERRAMENTA_REFERENCIAS: Tool = {
  name: "registrar_referencias",
  description: "Registra as referências escolhidas do banco, agrupadas como no planejamento.",
  input_schema: {
    type: "object",
    properties: {
      grupos: {
        type: "array",
        items: {
          type: "object",
          properties: { titulo: { type: "string" }, ids: { type: "array", items: { type: "string" } } },
          required: ["titulo", "ids"],
        },
      },
      pendencias: {
        type: "array",
        description: "Normas que deveriam entrar e não estão no banco (para a Ester pesquisar e cadastrar).",
        items: {
          type: "object",
          properties: {
            assunto: { type: "string" },
            detalhe: { type: "string" },
            para: { type: "string", enum: ["cliente", "ester"] },
          },
          required: ["assunto", "detalhe", "para"],
        },
      },
    },
    required: ["grupos", "pendencias"],
  },
};

export async function escolherReferencias(params: {
  perfil: string;
  estado: string;
  municipio: string;
  candidatas: CandidataReferencia[];
}): Promise<{ escolha: EscolhaReferencias; tokens: number }> {
  const lista = params.candidatas
    .map((c) => `${c.id} | ${c.abrangencia} | ${c.autoria} | ${c.nome} | ${c.ementa}`)
    .join("\n");
  const sistema = `Você escolhe a legislação do "Documentos em Elaboração" da TreinaVISA a partir de um banco de normas já conferidas na fonte. Use SOMENTE ids da lista; nunca invente norma. Escreva em português do Brasil.

Regras de relevância da Ester:
${REGRAS_SKILL.slice(REGRAS_SKILL.indexOf("<<<ARQUIVO references/referencias-normativas.md>>>"))}

Regras fixas e base normativa já verificada (do SKILL.md; ex.: a RDC 50/2002 entra em toda pasta de serviço de saúde):
${NORMAS_DO_SKILL}

Grupos, nesta ordem, só os que tiverem itens:
1. "${GRUPOS_REFERENCIAS.federal}" (leis federais, direitos do paciente, LGPD, exercício profissional em lei)
2. "${GRUPOS_REFERENCIAS.anvisa}"
3. "${GRUPOS_REFERENCIAS.trabalho}" (NRs, água, acessibilidade, climatização)
4. "LEGISLAÇÃO DO ESTADO DE ${params.estado.toLocaleUpperCase("pt-BR")}"
5. "LEGISLAÇÃO DO MUNICÍPIO DE ${params.municipio.toLocaleUpperCase("pt-BR")}"
6. "NORMAS PROFISSIONAIS - <PROFISSÃO>" (um grupo por categoria da equipe, ex.: "NORMAS PROFISSIONAIS - FISIOTERAPIA")
7. "${GRUPOS_REFERENCIAS.manuais}" (manuais, guias, NBR)
Dentro de cada grupo, ordem cronológica crescente.`;
  const { dados, tokens } = await chamarFerramenta<EscolhaReferencias>({
    sistema,
    maxTokens: 32000,
    ferramenta: FERRAMENTA_REFERENCIAS,
    conteudo: [
      {
        type: "text",
        text: `ESTABELECIMENTO:\n${params.perfil}\n\nBANCO DE NORMAS (id | abrangência | autoria | ato | ementa):\n${lista}\n\nEscolha as referências e registre com a ferramenta.`,
      },
    ],
  });
  return { escolha: dados, tokens };
}
