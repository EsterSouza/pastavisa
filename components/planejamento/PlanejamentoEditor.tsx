"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Button, buttonClass } from "@/components/ui/Button";
import { DateField, fieldClass, SelectField, TextField } from "@/components/ui/Field";
import { Feedback } from "@/components/ui/Status";
import { Card, CardHeader, FormSection, PageHeader } from "@/components/ui/Surface";
import type {
  AtividadeCnae,
  EquipamentoPlanejado,
  GrupoReferencias,
  InsumoPlanejado,
  LinhaMatriz,
  Planejamento,
  ReferenciaPlanejada,
} from "@/lib/planejamento/tipos";
import { CamposRotulados, ListaLinhas, proximoId, TabelaEditavel } from "./editores";

interface Pendencia {
  assunto: string;
  detalhe: string;
  para: "cliente" | "ester";
}

interface ItemRevisao {
  secao: string;
  nome: string;
  template: string;
}

interface Rascunho {
  planejamento: Planejamento;
  itens: ItemRevisao[];
  pendencias: Pendencia[];
  profissoes: string[];
  avisoFormulario: string;
  cidade: string;
  uf: string;
}

interface Salvo {
  rascunho: Rascunho;
  plano: Planejamento;
  usarAcesso: boolean;
  resolvidas: number[];
}

type Fase = "envio" | "lendo" | "revisao";

const CHAVE_LOCAL = "pastavisa.planejamento.rascunho";
const ACEITOS = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.docx,.txt";

const SECOES_SUGERIDAS = [
  "DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA",
  "POPs - ROTINAS GERAIS DE BIOSSEGURANÇA, LIMPEZA, ESTRUTURA E CONTROLE",
  "POPs - AVALIAÇÃO, REGISTRO E SEGURANÇA ASSISTENCIAL",
  "POPs - PROCEDIMENTOS ESTÉTICOS E TECNOLOGIAS",
  "POPs - PROCEDIMENTOS FACIAIS, CORPORAIS E CAPILARES",
  "POPs - PROCEDIMENTOS ESTÉTICOS INJETÁVEIS",
  "POPs - RECURSOS TERAPÊUTICOS MANUAIS, ELETROTERAPIA E REABILITAÇÃO",
  "POPs - PRÁTICAS INTEGRATIVAS E COMPLEMENTARES",
  "FICHAS DE ANAMNESE E AVALIAÇÃO",
  "TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO E TERMOS CORRELATOS",
  "PLANILHAS, FORMULÁRIOS E REGISTROS DE CONTROLE",
];

function hojeIso(): string {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function lerLocal(): Salvo | null {
  try {
    const texto = window.localStorage.getItem(CHAVE_LOCAL);
    return texto ? (JSON.parse(texto) as Salvo) : null;
  } catch {
    return null;
  }
}

function gravarLocal(salvo: Salvo | null) {
  try {
    if (salvo) window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(salvo));
    else window.localStorage.removeItem(CHAVE_LOCAL);
  } catch {
    // Sem armazenamento local (janela anônima): a tela funciona igual, só não guarda.
  }
}

async function lerResposta<T>(res: Response, padrao: string): Promise<T> {
  const texto = await res.text();
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    if (res.status === 504 || /timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(texto)) {
      throw new Error("A leitura passou do tempo do servidor (5 min). Tente com menos arquivos ou de novo.");
    }
    throw new Error(padrao);
  }
  if (!res.ok) throw new Error((dados as { error?: string }).error || padrao);
  return dados as T;
}

/** Resumo da cliente para a IA escolher as normas. */
function perfilDaCliente(plano: Planejamento, profissoes: string[]): string {
  const campo = (rotulo: RegExp) => plano.identificacao.find((c) => rotulo.test(c.rotulo))?.valor || "";
  return [
    `Nome: ${plano.nomeCliente}`,
    `Cidade/UF: ${plano.cidadeUf}`,
    `Atividade: ${campo(/atividade/i)}`,
    `Profissões da equipe: ${profissoes.join(", ") || campo(/forma[cç][aã]o/i)}`,
    `Responsável técnica: ${campo(/respons[aá]vel/i)}`,
    `Procedimentos: ${plano.procedimentos.join("; ")}`,
    `Equipamentos: ${plano.equipamentos.map((e) => e.nome).join("; ")}`,
    `Terceirizados e esterilização: ${plano.terceirizados.map((t) => `${t.rotulo}: ${t.valor || "não informado"}`).join("; ")}`,
    `Estrutura física: ${plano.estruturaFisica.join(" ")}`,
    `Documentos planejados: ${plano.secoes.flatMap((s) => s.itens).join("; ")}`,
  ].join("\n");
}

function nomeDoArquivo(plano: Planejamento): string {
  const nome = plano.nomeCliente.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `Documentos em elaboração - ${nome.toLocaleUpperCase("pt-BR")}.docx`;
}

function TextoReferencia({ referencia }: { referencia: ReferenciaPlanejada }) {
  const { texto, destaque, url } = referencia;
  const i = destaque ? texto.indexOf(destaque) : -1;
  return (
    <span>
      {referencia.naoConferida && (
        <span className="mr-1 rounded bg-status-warning-soft px-1.5 py-0.5 text-xs font-semibold text-status-warning">
          ainda não conferida no banco
        </span>
      )}
      {i >= 0 ? (
        <>
          {texto.slice(0, i)}
          <strong>{destaque}</strong>
          {texto.slice(i + destaque!.length)}
        </>
      ) : (
        texto
      )}
      {url && (
        <>
          {" "}
          <a href={url} target="_blank" rel="noreferrer" className="break-all text-brand-accent underline-offset-4 hover:underline">
            Abrir ↗
          </a>
        </>
      )}
    </span>
  );
}

export function PlanejamentoEditor() {
  const [fase, setFase] = useState<Fase>("envio");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [dataPlanejamento, setDataPlanejamento] = useState(hojeIso());
  const [versaoPasta, setVersaoPasta] = useState("Digital");
  const [plataforma, setPlataforma] = useState("Google Drive");
  const [corLogo, setCorLogo] = useState("");
  const [erro, setErro] = useState("");
  const [etapa, setEtapa] = useState("");
  const [segundos, setSegundos] = useState(0);

  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [plano, setPlano] = useState<Planejamento | null>(null);
  const [usarAcesso, setUsarAcesso] = useState(true);
  const [resolvidas, setResolvidas] = useState<number[]>([]);
  const [refsCarregando, setRefsCarregando] = useState(false);
  const [refsErro, setRefsErro] = useState("");
  const [refsPendencias, setRefsPendencias] = useState<Pendencia[]>([]);
  const [baixando, setBaixando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [salvoAnterior, setSalvoAnterior] = useState<Salvo | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSalvoAnterior(lerLocal());
  }, []);

  useEffect(() => {
    if (fase === "revisao" && rascunho && plano) gravarLocal({ rascunho, plano, usarAcesso, resolvidas });
  }, [fase, rascunho, plano, usarAcesso, resolvidas]);

  function iniciarRelogio(texto: string) {
    setEtapa(texto);
    setSegundos(0);
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = setInterval(() => setSegundos((s) => s + 1), 1000);
  }

  function pararRelogio() {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
  }

  async function buscarReferencias(base: Planejamento, uf: string, cidade: string, profissoes: string[]) {
    setRefsCarregando(true);
    setRefsErro("");
    try {
      const res = await fetch("/api/planejamento/referencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uf, municipio: cidade, perfil: perfilDaCliente(base, profissoes) }),
      });
      const dados = await lerResposta<{ grupos: GrupoReferencias[]; pendencias: Pendencia[] }>(
        res,
        "Não deu para escolher as referências."
      );
      setPlano((atual) => (atual ? { ...atual, referencias: dados.grupos } : atual));
      setRefsPendencias(dados.pendencias);
    } catch (error) {
      setRefsErro(error instanceof Error ? error.message : "Não deu para escolher as referências.");
    } finally {
      setRefsCarregando(false);
    }
  }

  async function montar(e: React.FormEvent) {
    e.preventDefault();
    if (arquivos.length === 0 && !observacoes.trim()) {
      setErro("Anexe o formulário (e o que mais a cliente mandou) ou cole as informações.");
      return;
    }
    setErro("");
    setFase("lendo");
    iniciarRelogio("Enviando os arquivos…");
    const opcoes = { dataPlanejamento, versaoPasta, plataforma, corLogo, observacoes };

    try {
      let res: Response;
      const planoUpload =
        arquivos.length > 0
          ? await lerResposta<
              | { mode: "multipart" }
              | {
                  mode: "direct";
                  supabaseUrl: string;
                  supabaseAnonKey: string;
                  bucket: string;
                  arquivos: Array<{ path: string; token: string; ref: string }>;
                }
            >(
              await fetch("/api/uploads/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ arquivos: arquivos.map((a) => a.name) }),
              }),
              "Não deu para preparar o envio dos arquivos."
            )
          : null;

      if (planoUpload?.mode === "direct") {
        const supabase = createClient(planoUpload.supabaseUrl, planoUpload.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        for (let i = 0; i < arquivos.length; i++) {
          setEtapa(`Enviando ${i + 1} de ${arquivos.length}: ${arquivos[i].name}`);
          const alvo = planoUpload.arquivos[i];
          const { error } = await supabase.storage
            .from(planoUpload.bucket)
            .uploadToSignedUrl(alvo.path, alvo.token, arquivos[i], { contentType: arquivos[i].type || undefined });
          if (error) throw new Error(`Erro no envio de ${arquivos[i].name}: ${error.message}`);
        }
        iniciarRelogio("Lendo os arquivos e montando o planejamento (leva de 1 a 4 minutos)…");
        res = await fetch("/api/planejamento/rascunho", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...opcoes,
            arquivos: planoUpload.arquivos.map((a, i) => ({ ref: a.ref, nome: arquivos[i].name })),
          }),
        });
      } else {
        const form = new FormData();
        for (const arquivo of arquivos) form.append("arquivos", arquivo);
        for (const [chave, valor] of Object.entries(opcoes)) form.append(chave, valor);
        iniciarRelogio("Lendo os arquivos e montando o planejamento (leva de 1 a 4 minutos)…");
        res = await fetch("/api/planejamento/rascunho", { method: "POST", body: form });
      }

      const dados = await lerResposta<Rascunho>(res, "Não deu para ler os arquivos.");
      setRascunho(dados);
      setPlano(dados.planejamento);
      setResolvidas([]);
      setRefsPendencias([]);
      setFase("revisao");
      void buscarReferencias(dados.planejamento, dados.uf, dados.cidade, dados.profissoes);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não deu para montar o planejamento.");
      setFase("envio");
    } finally {
      pararRelogio();
    }
  }

  function continuarSalvo() {
    if (!salvoAnterior) return;
    setRascunho(salvoAnterior.rascunho);
    setPlano(salvoAnterior.plano);
    setUsarAcesso(salvoAnterior.usarAcesso);
    setResolvidas(salvoAnterior.resolvidas);
    setFase("revisao");
  }

  function recomecar() {
    gravarLocal(null);
    setSalvoAnterior(null);
    setRascunho(null);
    setPlano(null);
    setArquivos([]);
    setObservacoes("");
    setFase("envio");
  }

  async function baixar() {
    if (!plano) return;
    setBaixando(true);
    setAviso("");
    try {
      const corpo: Planejamento = {
        ...plano,
        procedimentos: plano.procedimentos.map((p) => p.trim()).filter(Boolean),
        secoes: plano.secoes.map((s) => ({ ...s, itens: s.itens.map((i) => i.trim()).filter(Boolean) })),
        acessoEm: usarAcesso ? dataPlanejamento || hojeIso() : "",
      };
      const res = await fetch("/api/planejamento/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        throw new Error(dados.error || "Não deu para gerar o DOCX.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(plano);
      a.click();
      URL.revokeObjectURL(url);
      setAviso(`Baixado: ${nomeDoArquivo(plano)}. Abra no Word, ajuste o que quiser e salve na pasta da cliente.`);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "Não deu para gerar o DOCX.");
    } finally {
      setBaixando(false);
    }
  }

  const pendencias = useMemo(() => [...(rascunho?.pendencias || []), ...refsPendencias], [rascunho, refsPendencias]);
  const semTemplate = (rascunho?.itens || []).filter((i) => !i.template);

  // ── Envio ────────────────────────────────────────────────────────────────
  if (fase !== "revisao" || !plano || !rascunho) {
    return (
      <div>
        <PageHeader
          title="Planejamento"
          description="Monte o Documentos em Elaboração a partir do que a cliente mandou. Nada é gravado: no fim você baixa o DOCX."
          actions={
            <Link href="/pasta/nova" className={buttonClass("secondary")}>
              Já tenho o planejamento pronto ›
            </Link>
          }
        />
        {salvoAnterior && fase === "envio" && (
          <div className="mb-4">
            <Feedback tone="info" title="Há um planejamento em revisão neste navegador">
              {salvoAnterior.plano.nomeCliente}.{" "}
              <Button variant="quiet" onClick={continuarSalvo}>
                Continuar de onde parei
              </Button>
              <Button variant="quiet" onClick={recomecar}>
                Descartar
              </Button>
            </Feedback>
          </div>
        )}
        <form onSubmit={montar} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <FormSection
            title="O que a cliente mandou"
            description="Formulário do Forms, outros PDFs, fotos, documentos do Word. Pode escolher vários de uma vez."
          >
            <input
              type="file"
              multiple
              accept={ACEITOS}
              aria-label="Arquivos da cliente"
              disabled={fase === "lendo"}
              onChange={(e) => {
                const novos = Array.from(e.target.files || []);
                setArquivos((atuais) => [...atuais, ...novos.filter((n) => !atuais.some((a) => a.name === n.name && a.size === n.size))]);
                e.target.value = "";
              }}
              className="block w-full rounded-md border border-gray-300 bg-surface-card p-1 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-accent"
            />
            {arquivos.length > 0 && (
              <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 text-sm">
                {arquivos.map((arquivo, i) => (
                  <li key={`${arquivo.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0 truncate">{arquivo.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-ink-muted">
                      {(arquivo.size / 1024 / 1024).toFixed(1)} MB
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={fase === "lendo"}
                        onClick={() => setArquivos((atuais) => atuais.filter((_, j) => j !== i))}
                      >
                        Tirar
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <TextField
              label="Informações que vieram por fora (opcional)"
              hint="Cole mensagens de WhatsApp, e-mails ou o que ela contou. Vale mais que o formulário quando divergir."
              multiline
              rows={7}
              value={observacoes}
              onChange={setObservacoes}
            />
          </FormSection>

          <div className="space-y-4">
            <FormSection title="Dados do planejamento">
              <DateField label="Data do planejamento" value={dataPlanejamento} onChange={setDataPlanejamento} hint="Os prazos saem desta data." />
              <SelectField
                label="Versão da Pasta"
                value={versaoPasta}
                onChange={setVersaoPasta}
                options={["Digital", "Digital + Colorida", "Digital + Preto e Branco"].map((v) => ({ value: v, label: v }))}
              />
              <TextField label="Plataforma de entrega" value={plataforma} onChange={setPlataforma} />
              <TextField label="Cor de fundo da logomarca" value={corLogo} onChange={setCorLogo} placeholder="#000000" />
            </FormSection>
            {erro && <Feedback tone="erro" title="Não deu certo">{erro}</Feedback>}
            {fase === "lendo" ? (
              <Feedback tone="info" title="Montando o planejamento">
                {etapa} {segundos > 0 && `(${segundos} s)`}
              </Feedback>
            ) : (
              <Button type="submit" className="w-full">
                Montar planejamento
              </Button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ── Revisão ──────────────────────────────────────────────────────────────
  const mudar = (parte: Partial<Planejamento>) => setPlano((atual) => (atual ? { ...atual, ...parte } : atual));
  const paraCliente = pendencias.map((p, i) => ({ ...p, i })).filter((p) => p.para === "cliente");
  const paraEster = pendencias.map((p, i) => ({ ...p, i })).filter((p) => p.para !== "cliente");

  async function copiarPerguntas() {
    const texto = paraCliente
      .filter((p) => !resolvidas.includes(p.i))
      .map((p, n) => `${n + 1}. ${p.detalhe}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setAviso("Perguntas copiadas. Cole na conversa com a cliente.");
    } catch {
      setAviso("O navegador bloqueou a cópia.");
    }
  }

  const ListaPendencias = ({ itens }: { itens: Array<Pendencia & { i: number }> }) => (
    <ul className="space-y-2">
      {itens.map((p) => (
        <li key={p.i} className="flex gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            aria-label={`Resolvido: ${p.assunto}`}
            checked={resolvidas.includes(p.i)}
            onChange={(e) => setResolvidas((r) => (e.target.checked ? [...r, p.i] : r.filter((x) => x !== p.i)))}
          />
          <span className={resolvidas.includes(p.i) ? "text-ink-subtle line-through" : ""}>
            <strong>{p.assunto}</strong>: {p.detalhe}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <PageHeader
        title={`Planejamento: ${plano.nomeCliente || "cliente"}`}
        description="Confira e corrija aqui. O que está à esquerda não vai para o documento."
        actions={
          <>
            <Button variant="secondary" onClick={recomecar}>
              Começar outro
            </Button>
            <Button onClick={() => void baixar()} disabled={baixando}>
              {baixando ? "Gerando…" : "Baixar DOCX"}
            </Button>
          </>
        }
      />
      {aviso && (
        <div className="mb-4">
          <Feedback tone="info">{aviso}</Feedback>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {rascunho.avisoFormulario && (
            <Feedback tone="erro" title="Formulário incompleto">
              {rascunho.avisoFormulario}
            </Feedback>
          )}
          <Card>
            <CardHeader
              title="Perguntar à cliente"
              meta={`${paraCliente.length}`}
              actions={
                paraCliente.length > 0 && (
                  <Button variant="quiet" onClick={() => void copiarPerguntas()}>
                    Copiar
                  </Button>
                )
              }
            />
            <div className="p-4">{paraCliente.length ? <ListaPendencias itens={paraCliente} /> : <p className="text-sm text-ink-muted">Nada.</p>}</div>
          </Card>
          <Card>
            <CardHeader title="Para você decidir" meta={`${paraEster.length}`} />
            <div className="p-4">{paraEster.length ? <ListaPendencias itens={paraEster} /> : <p className="text-sm text-ink-muted">Nada.</p>}</div>
          </Card>
          {semTemplate.length > 0 && (
            <Card>
              <CardHeader title="Sem template no acervo" meta={`${semTemplate.length}`} />
              <ul className="space-y-1 p-4 text-sm">
                {semTemplate.map((item, i) => (
                  <li key={i}>{item.nome}</li>
                ))}
              </ul>
            </Card>
          )}
        </aside>

        <div className="space-y-4">
          <FormSection title="Cliente">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Nome nos títulos e no rodapé" value={plano.nomeCliente} onChange={(v) => mudar({ nomeCliente: v })} />
              <TextField label="Cidade/UF no rodapé" value={plano.cidadeUf} onChange={(v) => mudar({ cidadeUf: v })} />
            </div>
            <TextField label="Introdução" multiline rows={4} value={plano.introducao} onChange={(v) => mudar({ introducao: v })} />
          </FormSection>

          <FormSection title="Prazos e status" description="Calculados pela data do planejamento (15 dias úteis, sem feriados nacionais).">
            <CamposRotulados campos={plano.cronograma} onChange={(cronograma) => mudar({ cronograma })} />
          </FormSection>

          <FormSection title="Identificação">
            <CamposRotulados campos={plano.identificacao} onChange={(identificacao) => mudar({ identificacao })} />
          </FormSection>

          <FormSection title="Estrutura física informada" description="Um parágrafo por bloco; linha em branco separa os parágrafos.">
            <textarea
              aria-label="Estrutura física"
              className={fieldClass}
              rows={8}
              value={plano.estruturaFisica.join("\n\n")}
              onChange={(e) => mudar({ estruturaFisica: e.target.value.split(/\n\s*\n/) })}
            />
          </FormSection>

          <FormSection title="Serviços terceirizados informados">
            <CamposRotulados campos={plano.terceirizados} onChange={(terceirizados) => mudar({ terceirizados })} rotuloNovo="Serviço" />
          </FormSection>

          <FormSection title="Relação geral de serviços e procedimentos" description="Um por linha.">
            <ListaLinhas rotulo="Procedimentos" itens={plano.procedimentos} onChange={(procedimentos) => mudar({ procedimentos })} />
          </FormSection>

          <FormSection title="Documentos a elaborar" description="Um documento por linha. A numeração em algarismos romanos sai sozinha.">
            {plano.secoes.map((secao, i) => (
              <div key={i} className="space-y-2 rounded-md border border-gray-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-muted">{i + 1}.</span>
                  <input
                    aria-label="Título da seção"
                    className={`${fieldClass} font-semibold`}
                    value={secao.titulo}
                    onChange={(e) => mudar({ secoes: plano.secoes.map((s, j) => (j === i ? { ...s, titulo: e.target.value } : s)) })}
                  />
                  <Button variant="quiet" onClick={() => mudar({ secoes: plano.secoes.filter((_, j) => j !== i) })}>
                    Tirar
                  </Button>
                </div>
                <ListaLinhas
                  rotulo={secao.titulo}
                  itens={secao.itens}
                  onChange={(itens) => mudar({ secoes: plano.secoes.map((s, j) => (j === i ? { ...s, itens } : s)) })}
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Acrescentar seção"
                className={`${fieldClass} max-w-md`}
                value=""
                onChange={(e) => e.target.value && mudar({ secoes: [...plano.secoes, { titulo: e.target.value, itens: [] }] })}
              >
                <option value="">+ Acrescentar seção…</option>
                {SECOES_SUGERIDAS.filter((t) => !plano.secoes.some((s) => s.titulo === t)).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={plano.avisoPrazo} onChange={(e) => mudar({ avisoPrazo: e.target.checked })} />
                Aviso amarelo &quot;PRAZO DE CONFECÇÃO: ATÉ 15 DIAS ÚTEIS&quot;
              </label>
            </div>
          </FormSection>

          <FormSection title="Tabela de equipamentos">
            <TabelaEditavel<EquipamentoPlanejado>
              colunas={[
                { chave: "id", titulo: "ID", largura: "4.5rem" },
                { chave: "nome", titulo: "Equipamento", largura: "minmax(0,2fr)" },
                { chave: "marca", titulo: "Marca", largura: "minmax(0,1fr)" },
                { chave: "serie", titulo: "Nº de série", largura: "minmax(0,1fr)" },
                { chave: "registroAnvisa", titulo: "Registro Anvisa", largura: "minmax(0,1fr)" },
              ]}
              linhas={plano.equipamentos}
              onChange={(equipamentos) => mudar({ equipamentos })}
              nova={(l) => ({ id: proximoId("E", l), nome: "", marca: "", serie: "", registroAnvisa: "" })}
            />
          </FormSection>

          <FormSection title="Tabela de insumos" description="Só os informados pelo nome. Sem linhas, a tabela não sai.">
            <TabelaEditavel<InsumoPlanejado>
              colunas={[
                { chave: "id", titulo: "ID", largura: "4.5rem" },
                { chave: "nome", titulo: "Insumo, produto ou material", largura: "minmax(0,2fr)" },
                { chave: "marca", titulo: "Marca ou linha", largura: "minmax(0,1fr)" },
              ]}
              linhas={plano.insumos}
              onChange={(insumos) => mudar({ insumos })}
              nova={(l) => ({ id: proximoId("I", l), nome: "", marca: "" })}
            />
          </FormSection>

          <FormSection title="Procedimentos × equipamentos × insumos">
            <TabelaEditavel<LinhaMatriz>
              colunas={[
                { chave: "id", titulo: "ID", largura: "4.5rem" },
                { chave: "procedimento", titulo: "Procedimento", largura: "minmax(0,2fr)" },
                { chave: "equipamentos", titulo: "Equipamentos", largura: "minmax(0,1fr)" },
                { chave: "insumos", titulo: "Insumos", largura: "minmax(0,1fr)" },
              ]}
              linhas={plano.matriz}
              onChange={(matriz) => mudar({ matriz })}
              nova={(l) => ({ id: proximoId("P", l), procedimento: "", equipamentos: "", insumos: "" })}
            />
          </FormSection>

          <FormSection
            title="Legislação e referências"
            description="Só normas do banco VISA Legislação, já conferidas na fonte. Em negrito, o que sai em negrito no documento."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={refsCarregando}
                onClick={() => void buscarReferencias(plano, rascunho.uf, rascunho.cidade, rascunho.profissoes)}
              >
                {refsCarregando ? "Escolhendo no banco…" : plano.referencias.length ? "Escolher de novo" : "Escolher no banco"}
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={usarAcesso} onChange={(e) => setUsarAcesso(e.target.checked)} />
                Pôr &quot;Acesso em:&quot; (a NBR 6023 exige em documento online)
              </label>
            </div>
            {refsErro && <Feedback tone="erro">{refsErro}</Feedback>}
            {plano.referencias.map((grupo, g) => (
              <div key={g} className="space-y-2 rounded-md border border-gray-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-muted">{g + 1}.</span>
                  <input
                    aria-label="Título do grupo"
                    className={`${fieldClass} font-semibold`}
                    value={grupo.titulo}
                    onChange={(e) =>
                      mudar({ referencias: plano.referencias.map((x, j) => (j === g ? { ...x, titulo: e.target.value } : x)) })
                    }
                  />
                </div>
                <ul className="space-y-2">
                  {grupo.itens.map((ref, r) => (
                    <li key={r} className="flex items-start justify-between gap-2 text-sm">
                      <TextoReferencia referencia={ref} />
                      <Button
                        variant="quiet"
                        onClick={() =>
                          mudar({
                            referencias: plano.referencias
                              .map((x, j) => (j === g ? { ...x, itens: x.itens.filter((_, k) => k !== r) } : x))
                              .filter((x) => x.itens.length),
                          })
                        }
                      >
                        Tirar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </FormSection>

          <FormSection title="Atividades econômicas (CNAE)" description="Só com cartão CNPJ. Sem linhas, a tabela não sai.">
            <TabelaEditavel<AtividadeCnae>
              colunas={[
                { chave: "tipo", titulo: "Tipo", largura: "8rem" },
                { chave: "codigo", titulo: "Código", largura: "9rem" },
                { chave: "descricao", titulo: "Descrição", largura: "minmax(0,1fr)" },
              ]}
              linhas={plano.cnaes}
              onChange={(cnaes) => mudar({ cnaes })}
              nova={() => ({ tipo: "Secundária", codigo: "", descricao: "" })}
            />
          </FormSection>

          <div className="flex justify-end">
            <Button onClick={() => void baixar()} disabled={baixando}>
              {baixando ? "Gerando…" : "Baixar DOCX"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
