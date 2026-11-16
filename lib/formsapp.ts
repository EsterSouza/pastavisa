import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadBrandAssets } from "@/lib/commercial-planner/brand-assets";

/**
 * Respostas do formulário "Preencha esse formulário para personalizar sua Pasta
 * Sanitária" no forms.app (plano grátis). A API pública só lê textos; as fotos e
 * a logo vêm pelo endereço que o próprio painel usa, com o fileToken da resposta.
 */
export const FORMULARIO_PASTA = "681a148e0ce0ae0002c004b3";
const API = "https://api.forms.app/v1";
// ponytail: endereço interno do painel do forms.app, fora da documentação. Se
// ele mudar, o download quebra e a saída volta a ser a pasta do Drive.
const ARQUIVO = "https://file.forms.app/answerfileurlwithtoken";

interface Resposta {
  _id: string;
  createDate: string;
  publicId: string;
  fileToken: string;
  answers: Array<Record<string, unknown> & { q: string }>;
}

interface Pergunta {
  _id: string;
  question?: string;
  displayOrder?: number;
}

export class FormsAppErro extends Error {}

async function api<T>(caminho: string): Promise<T> {
  const chave = process.env.FORMSAPP_API_KEY;
  if (!chave) throw new FormsAppErro("A chave do forms.app (FORMSAPP_API_KEY) não está configurada.");
  const res = await fetch(API + caminho, { headers: { "X-Api-Key": chave }, cache: "no-store" });
  const corpo = await res.json().catch(() => null);
  if (!res.ok || !corpo?.success) {
    throw new FormsAppErro(`O forms.app recusou a consulta (${res.status}).`);
  }
  return corpo.data as T;
}

async function todasAsRespostas(): Promise<Resposta[]> {
  const todas: Resposta[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const dados = await api<{ result: Resposta[]; totalCount: number }>(`/form/${FORMULARIO_PASTA}/answer/p/${pagina}`);
    todas.push(...dados.result);
    if (!dados.result.length || todas.length >= dados.totalCount) break;
  }
  return todas;
}

async function perguntas(): Promise<Map<string, Pergunta>> {
  const form = await api<{ questions: Pergunta[] }>(`/form/${FORMULARIO_PASTA}`);
  return new Map(form.questions.map((q) => [q._id, q]));
}

function nomeDa(resposta: Resposta): string {
  const fn = resposta.answers.find((a) => a.fn)?.fn as { f?: string; l?: string } | undefined;
  return [fn?.f, fn?.l].filter(Boolean).join(" ").trim() || "Sem nome";
}

/** Texto de uma resposta, nos formatos curtos da API (fn, p, a, c, b, n, d, t). */
export function textoDaResposta(r: Record<string, unknown>): string {
  const fn = r.fn as Record<string, string> | undefined;
  const p = r.p as Record<string, string> | undefined;
  const a = r.a as Record<string, string> | undefined;
  const c = r.c as Array<{ t?: string; o?: string }> | undefined;
  if (fn) return [fn.p, fn.f, fn.m, fn.l, fn.s].filter(Boolean).join(" ");
  if (p) return [p.c, p.a, p.p, p.e].filter(Boolean).join(" ");
  if (a) return [a.a1, a.a2, a.c, a.s, a.z, a.co].filter(Boolean).join(", ");
  if (c) return c.map((x) => x.t || x.o).filter(Boolean).join("; ");
  if (typeof r.b === "boolean") return r.b ? "Sim" : "Não";
  if (r.n !== undefined) return String(r.n);
  if (r.d) return String(r.d);
  return typeof r.t === "string" ? r.t : "";
}

export interface RespostaResumo {
  id: string;
  nome: string;
  enviadaEm: string;
  versao: string;
  plataforma: string;
  arquivos: number;
}

export async function listarRespostas(): Promise<RespostaResumo[]> {
  const [respostas, mapa] = await Promise.all([todasAsRespostas(), perguntas()]);
  const lista = Array.from(mapa.values());
  const perguntaDaVersao = lista.find((q) => /vers[aã]o da pasta/i.test(q.question || ""))?._id;
  const perguntaDaPlataforma = lista.find((q) => /plataforma/i.test(q.question || ""))?._id;
  return respostas
    .map((r) => ({
      id: r._id,
      nome: nomeDa(r),
      enviadaEm: r.createDate,
      versao: textoDaResposta(r.answers.find((a) => a.q === perguntaDaVersao) || { q: "" }),
      plataforma: textoDaResposta(r.answers.find((a) => a.q === perguntaDaPlataforma) || { q: "" }),
      arquivos: r.answers.reduce((n, a) => n + (Array.isArray(a.f) ? a.f.length : 0), 0),
    }))
    .sort((a, b) => b.enviadaEm.localeCompare(a.enviadaEm));
}

async function buscarResposta(id: string): Promise<Resposta> {
  const resposta = (await todasAsRespostas()).find((r) => r._id === id);
  if (!resposta) throw new FormsAppErro("Essa resposta não existe mais no forms.app.");
  return resposta;
}

const dataBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export interface ArquivoDaResposta {
  id: string;
  /** "logo" quando veio na pergunta da logo; o planejamento marca pelo nome. */
  tipo: "logo" | "foto";
}

/** PDF com as respostas, na ordem do formulário, e a lista dos arquivos enviados. */
export async function respostaCompleta(id: string): Promise<{
  nome: string;
  nomePdf: string;
  pdf: Uint8Array;
  arquivos: ArquivoDaResposta[];
}> {
  const [resposta, mapa] = await Promise.all([buscarResposta(id), perguntas()]);
  const ordem = (q: string) => mapa.get(q)?.displayOrder ?? 999;
  const nome = nomeDa(resposta);
  const quando = dataBr(resposta.createDate);
  const arquivos: ArquivoDaResposta[] = [];
  const linhas: Array<[string, string]> = [];

  for (const r of [...resposta.answers].sort((a, b) => ordem(a.q) - ordem(b.q))) {
    const pergunta = (mapa.get(r.q)?.question || "(pergunta removida)").trim();
    let valor = textoDaResposta(r);
    if (Array.isArray(r.f)) {
      const tipo = /logo/i.test(pergunta) ? "logo" : "foto";
      for (const f of r.f as Array<{ fid: string }>) arquivos.push({ id: f.fid, tipo });
      valor = r.f.length ? `${r.f.length} arquivo(s) enviado(s)` : "(nenhum arquivo)";
    }
    if (typeof r.ac === "string" && r.ac) valor += (valor ? "\nComentário: " : "") + r.ac;
    linhas.push([pergunta, valor || "(sem resposta)"]);
  }

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const marca = await loadBrandAssets();
  const fonte = async (bytes: Uint8Array | undefined, reserva: StandardFonts): Promise<PDFFont> =>
    bytes ? pdf.embedFont(bytes, { subset: true }).catch(() => pdf.embedFont(reserva)) : pdf.embedFont(reserva);
  const regular = await fonte(marca.body, StandardFonts.Helvetica);
  const negrito = await fonte(marca.bodyStrong, StandardFonts.HelveticaBold);

  const [L, A, M] = [595.28, 841.89, 50];
  let pagina = pdf.addPage([L, A]);
  let y = A - M;
  const escrever = (texto: string, f: PDFFont, tam: number, cinza: number, depois: number) => {
    for (const paragrafo of texto.split(/\r?\n/)) {
      let linha = "";
      const palavras = paragrafo.split(/\s+/);
      for (let i = 0; i <= palavras.length; i++) {
        const tenta = i < palavras.length ? (linha ? `${linha} ${palavras[i]}` : palavras[i]) : null;
        if (tenta !== null && (f.widthOfTextAtSize(tenta, tam) <= L - 2 * M || !linha)) {
          linha = tenta;
          continue;
        }
        if (y < M + tam) {
          pagina = pdf.addPage([L, A]);
          y = A - M;
        }
        pagina.drawText(linha, { x: M, y, size: tam, font: f, color: rgb(cinza, cinza, cinza + 0.05) });
        y -= tam * 1.35;
        linha = i < palavras.length ? palavras[i] : "";
      }
    }
    y -= depois;
  };
  escrever("Preencha esse formulário para personalizar sua Pasta Sanitária", negrito, 15, 0.1, 2);
  escrever(`${nome} · enviado em ${quando} · resposta ${resposta.publicId}`, regular, 10, 0.4, 14);
  for (const [pergunta, valor] of linhas) {
    escrever(pergunta, negrito, 11, 0.1, 1);
    escrever(valor, regular, 11, 0.15, 10);
  }

  const seguro = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return { nome, nomePdf: seguro(`Formulário - ${nome} - ${quando}.pdf`), pdf: await pdf.save(), arquivos };
}

/** Um arquivo da resposta: o forms.app devolve o nome original e um link de 59 s. */
export async function arquivoDaResposta(respostaId: string, arquivoId: string): Promise<{
  nome: string;
  tipo: string;
  conteudo: ArrayBuffer;
}> {
  const resposta = await buscarResposta(respostaId);
  const res = await fetch(
    `${ARQUIVO}/${encodeURIComponent(respostaId)}/${encodeURIComponent(arquivoId)}?token=${encodeURIComponent(resposta.fileToken)}`,
    { cache: "no-store" }
  );
  const corpo = await res.json().catch(() => null);
  if (!corpo?.success || !corpo.data?.url) throw new FormsAppErro("O forms.app não liberou esse arquivo.");
  const arquivo = await fetch(corpo.data.url, { cache: "no-store" });
  if (!arquivo.ok) throw new FormsAppErro("Não deu para baixar o arquivo do forms.app.");
  return {
    nome: String(corpo.data.fileName || arquivoId),
    tipo: String(corpo.data.fileType || arquivo.headers.get("content-type") || "application/octet-stream"),
    conteudo: await arquivo.arrayBuffer(),
  };
}
