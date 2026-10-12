import { LOGO_TREINAVISA_PNG_BASE64 } from "./logo-treinavisa";
import { MODELOS_HTML } from "./modelos-html";

/**
 * Os 4 e-mails da pasta para a cliente, montados como nos modelos HTML da Ester:
 * cada {{CAMPO}} do modelo é trocado pelo valor do formulário. Roda no navegador
 * (prévia) e no servidor (envio); só muda a logo, que no envio vai como anexo
 * embutido (cid) porque o Gmail não mostra data:image.
 */

export type TipoEmail = keyof typeof MODELOS_HTML;

export type CampoEmail = {
  chave: string;
  rotulo: string;
  dica?: string;
  numero?: boolean;
  link?: boolean;
};

export type DefinicaoEmail = {
  tipo: TipoEmail;
  titulo: string;
  quando: string;
  assunto: string;
  campos: CampoEmail[];
};

const NOME: CampoEmail = { chave: "NOME_CLIENTE", rotulo: "Nome da cliente" };
const SAUDACAO: CampoEmail = { chave: "SAUDACAO", rotulo: "Saudação", dica: "Ex.: Prezada, Prezada Dra." };
const NUM_DOCUMENTOS: CampoEmail = { chave: "NUM_DOCUMENTOS", rotulo: "Quantidade de documentos", numero: true };
const LINK_DRIVE: CampoEmail = { chave: "LINK_PASTA", rotulo: "Link da pasta digital (Drive)", link: true };

export const EMAILS: DefinicaoEmail[] = [
  {
    tipo: "boas-vindas",
    titulo: "Boas-vindas",
    quando: "No início do projeto, com o acesso à pasta digital.",
    assunto: "Pasta Sanitária Personalizada",
    campos: [
      NOME,
      { chave: "NOME_ESTABELECIMENTO", rotulo: "Nome do estabelecimento" },
      { chave: "DATA_INICIO", rotulo: "Data de início do projeto" },
      { chave: "MUNICIPIO_UF", rotulo: "Município e UF" },
      { chave: "EMAIL_LEITOR", rotulo: "E-mail com acesso de leitor" },
      LINK_DRIVE,
    ],
  },
  {
    tipo: "apreciacao",
    titulo: "Período de apreciação",
    quando: "Quando os PDFs estão prontos para a cliente revisar.",
    assunto: "Período de Apreciação da Pasta Sanitária",
    campos: [
      SAUDACAO,
      NOME,
      { chave: "LINK_PASTA", rotulo: "Link para visualização (OneDrive)", link: true },
      { chave: "SENHA", rotulo: "Senha de acesso" },
      { chave: "PRAZO_DIAS", rotulo: "Prazo (dias úteis)", dica: "Ex.: 03 (três)" },
    ],
  },
  {
    tipo: "entrega-fisica",
    titulo: "Entrega: digital + pasta física",
    quando: "Na entrega final de quem contratou a pasta impressa.",
    assunto: "Entrega da Pasta Sanitária Personalizada",
    campos: [SAUDACAO, NOME, NUM_DOCUMENTOS, LINK_DRIVE],
  },
  {
    tipo: "entrega-digital",
    titulo: "Entrega final: pasta digital",
    quando: "Na entrega final de quem contratou só a versão digital.",
    assunto: "Entrega da Pasta Sanitária Personalizada",
    campos: [SAUDACAO, NOME, NUM_DOCUMENTOS, LINK_DRIVE],
  },
];

export function definicaoEmail(tipo: string): DefinicaoEmail | undefined {
  return EMAILS.find((email) => email.tipo === tipo);
}

/** Pasta impressa (colorida ou preto e branco) recebe o e-mail de entrega com a parte física. */
export function entregaDaVersao(versaoPasta: string | null | undefined): TipoEmail {
  return /colorid|preto|f[íi]sic|impress/i.test(versaoPasta || "") ? "entrega-fisica" : "entrega-digital";
}

export type PastaParaEmail = {
  clienteNomeFantasia?: string | null;
  clienteRazaoSocial?: string | null;
  clienteProprietarioNome?: string | null;
  clienteRtNome?: string | null;
  clienteCidade?: string | null;
  clienteEstado?: string | null;
  clienteEmail?: string | null;
  inicioProjeto?: string | Date | null;
  criadaEm?: string | Date | null;
  linkDrive?: string | null;
  linkOneDrive?: string | null;
  senhaOneDrive?: string | null;
};

function dataBr(value: string | Date | null | undefined, utc: boolean): string {
  if (!value) return "";
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR", utc ? { timeZone: "UTC" } : undefined);
}

/** Valores iniciais do formulário, tirados da pasta. Tudo continua editável antes do envio. */
export function valoresIniciais(tipo: TipoEmail, pasta: PastaParaEmail, documentosGerados: number): Record<string, string> {
  const cidade = (pasta.clienteCidade || "").trim();
  const uf = (pasta.clienteEstado || "").trim();
  const todos: Record<string, string> = {
    SAUDACAO: "Prezada",
    NOME_CLIENTE: (pasta.clienteProprietarioNome || pasta.clienteRtNome || "").trim(),
    NOME_ESTABELECIMENTO: (pasta.clienteNomeFantasia || pasta.clienteRazaoSocial || "").trim(),
    // inicioProjeto fica ao meio-dia UTC (lib/elaboracao-prazos.ts); criadaEm é um instante local.
    DATA_INICIO: pasta.inicioProjeto ? dataBr(pasta.inicioProjeto, true) : dataBr(pasta.criadaEm, false),
    MUNICIPIO_UF: cidade && uf ? `${cidade} (${uf})` : cidade || uf,
    EMAIL_LEITOR: (pasta.clienteEmail || "").trim(),
    LINK_PASTA: ((tipo === "apreciacao" ? pasta.linkOneDrive : pasta.linkDrive) || "").trim(),
    SENHA: (pasta.senhaOneDrive || "").trim(),
    PRAZO_DIAS: "03 (três)",
    NUM_DOCUMENTOS: documentosGerados > 0 ? String(documentosGerados) : "",
  };
  const definicao = definicaoEmail(tipo);
  return Object.fromEntries((definicao?.campos || []).map((campo) => [campo.chave, todos[campo.chave] || ""]));
}

export function assuntoInicial(tipo: TipoEmail, pasta: PastaParaEmail): string {
  const base = definicaoEmail(tipo)?.assunto || "Pasta Sanitária Personalizada";
  const estabelecimento = (pasta.clienteNomeFantasia || pasta.clienteRazaoSocial || "").trim();
  return estabelecimento ? `${base} · ${estabelecimento}` : base;
}

/** O que falta para poder enviar, como nos avisos dos modelos. Vazio = pode enviar. */
export function problemasDoEmail(tipo: TipoEmail, valores: Record<string, string>): string[] {
  const definicao = definicaoEmail(tipo);
  if (!definicao) return ["Tipo de e-mail desconhecido."];
  const problemas: string[] = [];
  for (const campo of definicao.campos) {
    const valor = (valores[campo.chave] || "").trim();
    if (!valor) {
      problemas.push(`Preencha "${campo.rotulo}".`);
    } else if (campo.numero && !/^\d+$/.test(valor)) {
      problemas.push(`"${campo.rotulo}" aceita só números.`);
    } else if (campo.link) {
      try {
        if (new URL(valor).protocol !== "https:") throw new Error();
      } catch {
        problemas.push(`"${campo.rotulo}" precisa ser um link que começa com https://.`);
      }
    }
  }
  return problemas;
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const LOGO_CID = "cid:logo-treinavisa";

/** HTML final. "previa" troca a logo pelo data:image para aparecer no iframe do app. */
export function montarEmail(tipo: TipoEmail, valores: Record<string, string>, modo: "envio" | "previa"): string {
  let html: string = MODELOS_HTML[tipo];
  for (const campo of definicaoEmail(tipo)?.campos || []) {
    const valor = (valores[campo.chave] || "").trim();
    const reserva = campo.link ? "#" : `[${campo.rotulo.toLowerCase()}]`;
    html = html.split(`{{${campo.chave}}}`).join(esc(valor || reserva));
  }
  if (modo === "previa") html = html.split(LOGO_CID).join(`data:image/png;base64,${LOGO_TREINAVISA_PNG_BASE64}`);
  return html;
}
