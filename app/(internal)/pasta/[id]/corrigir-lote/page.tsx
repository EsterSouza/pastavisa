"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";

interface DocumentoUploadVersao {
  id: string;
  outputPath: string;
  substituicoes: string | null;
  criadaEm: string;
}

interface DocumentoUploadItem {
  id: string;
  nomeArquivo: string;
  uploadPath: string;
  outputPath: string | null;
  status: string;
  mensagemErro: string | null;
  criadoEm: string;
  versoes: DocumentoUploadVersao[];
}

interface Par {
  de: string;
  para: string;
}

interface ContagemPorPar {
  de: string;
  total: number;
  corpo: number;
  cabecalho: number;
  rodape: number;
}

interface ResultadoRodada {
  status: "processado" | "erro";
  aplicadas?: string[];
  naoEncontradas?: string[];
  logoSubstituida?: boolean;
  contagens?: ContagemPorPar[];
  erro?: string;
}

type EscopoParte = "corpo" | "cabecalho" | "rodape";

interface OcorrenciaPlanejada {
  escopo: EscopoParte;
  parte: string;
  contexto: string;
}

interface SubstituicaoPlanejada extends ContagemPorPar {
  para: string;
  ocorrencias: OcorrenciaPlanejada[];
}

interface AnalisePlano {
  hashOrigem: string;
  baseCorrigida: boolean;
  totalOcorrencias: number;
  substituicoes: SubstituicaoPlanejada[];
}

type AnaliseEntrada = { ok: true; plano: AnalisePlano } | { ok: false; erro: string };

type UploadSignPlan =
  | { mode: "multipart" }
  | {
      mode: "direct";
      supabaseUrl: string;
      supabaseAnonKey: string;
      bucket: string;
      uploads: Array<{ nomeArquivo: string; path: string; token: string; ref: string }>;
    };

/**
 * Acima disto a contagem deixa de parecer um dado comercial e passa a parecer um
 * trecho genérico casando em todo o documento (um "Ltda" solto, por exemplo). Não
 * bloqueia: pede confirmação explícita, porque documentos longos legitimamente
 * repetem a razão social muitas vezes.
 */
const LIMITE_OCORRENCIAS_INESPERADAS = 20;

const ESCOPO_LABEL: Record<EscopoParte, string> = {
  corpo: "corpo",
  cabecalho: "cabeçalho",
  rodape: "rodapé",
};

const STATUS_DOC_LABEL: Record<string, { texto: string; classe: string }> = {
  processado: { texto: "Processado", classe: "text-green-600" },
  restaurado: { texto: "Restaurado", classe: "text-amber-600" },
  erro: { texto: "Erro", classe: "text-red-500" },
};

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Identidade da rodada analisada. Mudar qualquer par vence a análise: os números
 * que o operador revisou passam a descrever outra rodada, e aplicar com eles seria
 * aplicar às cegas.
 */
function assinaturaDaRodada(pares: Par[]): string {
  return JSON.stringify(pares.map((p) => [p.de, p.para]));
}

async function readApiResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let data: { error?: string } | T;
  try {
    data = JSON.parse(text) as { error?: string } | T;
  } catch {
    throw new Error(fallback);
  }
  if (!res.ok) {
    throw new Error(("error" in (data as { error?: string }) && (data as { error?: string }).error) || fallback);
  }
  return data as T;
}

export default function CorrigirLotePasta() {
  const { id } = useParams<{ id: string }>();

  const [docs, setDocs] = useState<DocumentoUploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [pares, setPares] = useState<Par[]>([{ de: "", para: "" }]);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [analises, setAnalises] = useState<Record<string, AnaliseEntrada>>({});
  const [analiseAssinatura, setAnaliseAssinatura] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [analiseDone, setAnaliseDone] = useState(0);
  const [analiseTotal, setAnaliseTotal] = useState(0);
  const [analiseError, setAnaliseError] = useState("");
  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<string>>(new Set());
  const [confirmouRessalvas, setConfirmouRessalvas] = useState(false);

  const [applying, setApplying] = useState(false);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [currentDocName, setCurrentDocName] = useState("");
  const [resultados, setResultados] = useState<Record<string, ResultadoRodada>>({});
  const [applyError, setApplyError] = useState("");
  const [applySummary, setApplySummary] = useState("");

  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingBatch, setRemovingBatch] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [restauracaoMensagem, setRestauracaoMensagem] = useState("");

  function carregarDocs() {
    return fetch(`/api/pastas/${id}/uploads-corrigidos`)
      .then((r) => r.json())
      .then((data: DocumentoUploadItem[]) => setDocs(data));
  }

  useEffect(() => {
    setLoading(true);
    carregarDocs().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const normalizedSearch = normalizeForMatch(search.trim());
  const docsFiltrados = useMemo(() => {
    if (!normalizedSearch) return docs;
    return docs.filter((doc) => normalizeForMatch(doc.nomeArquivo).includes(normalizedSearch));
  }, [docs, normalizedSearch]);

  const paresValidos = useMemo(() => pares.filter((p) => p.de.trim().length > 0), [pares]);
  const docsSelecionados = useMemo(
    () => docs.filter((doc) => selectedDocs.has(doc.id)),
    [docs, selectedDocs]
  );

  const assinaturaAtual = useMemo(() => assinaturaDaRodada(paresValidos), [paresValidos]);
  const analiseVencida = analiseAssinatura !== null && analiseAssinatura !== assinaturaAtual;
  const analiseValida = analiseAssinatura !== null && !analiseVencida;

  // Uma rodada só de logo não tem o que contar: o preflight conta ocorrências de
  // texto. Nesse caso a revisão é dispensada, e é a única situação em que aplicar
  // segue sem análise.
  const rodadaTemTexto = paresValidos.length > 0;

  const revisao = useMemo(() => {
    const semOcorrencia: string[] = [];
    const falharam: Array<{ nome: string; erro: string }> = [];
    const sobreCorrecao: string[] = [];
    const excessivas: Array<{ nome: string; de: string; total: number }> = [];
    const naoAnalisados: string[] = [];
    let totalOcorrencias = 0;

    for (const doc of docsSelecionados) {
      const entrada = analiseValida ? analises[doc.id] : undefined;
      if (!entrada) {
        naoAnalisados.push(doc.nomeArquivo);
        continue;
      }
      if (!entrada.ok) {
        falharam.push({ nome: doc.nomeArquivo, erro: entrada.erro });
        continue;
      }
      totalOcorrencias += entrada.plano.totalOcorrencias;
      if (entrada.plano.totalOcorrencias === 0) semOcorrencia.push(doc.nomeArquivo);
      if (entrada.plano.baseCorrigida) sobreCorrecao.push(doc.nomeArquivo);
      for (const sub of entrada.plano.substituicoes) {
        if (sub.total > LIMITE_OCORRENCIAS_INESPERADAS) {
          excessivas.push({ nome: doc.nomeArquivo, de: sub.de, total: sub.total });
        }
      }
    }

    return { semOcorrencia, falharam, sobreCorrecao, excessivas, naoAnalisados, totalOcorrencias };
  }, [analiseValida, analises, docsSelecionados]);

  // Ressalva é o que pede confirmação. Documento não analisado não é ressalva: é
  // bloqueio, porque ali não existe número nenhum para o operador confirmar.
  const temRessalva =
    revisao.semOcorrencia.length > 0 ||
    revisao.falharam.length > 0 ||
    revisao.excessivas.length > 0;

  const resumoPorPar = useMemo(
    () =>
      paresValidos.map((par, indice) => {
        let total = 0;
        let documentosAfetados = 0;
        for (const doc of docsSelecionados) {
          const entrada = analiseValida ? analises[doc.id] : undefined;
          if (!entrada?.ok) continue;
          // O preflight devolve as substituições na mesma ordem em que foram
          // enviadas, então o índice é a ligação confiável — dois pares podem ter
          // o mesmo "de" e casar pelo texto misturaria os dois.
          const sub = entrada.plano.substituicoes[indice];
          if (!sub) continue;
          total += sub.total;
          if (sub.total > 0) documentosAfetados++;
        }
        return { ...par, total, documentosAfetados };
      }),
    [analiseValida, analises, docsSelecionados, paresValidos]
  );

  const bloqueioAplicar = (() => {
    if (selectedDocs.size === 0) return "Selecione ao menos um documento.";
    if (!rodadaTemTexto && !logoFile) return "Informe uma logo nova e/ou ao menos um par de substituição.";
    if (rodadaTemTexto && !analiseValida) {
      return analiseVencida
        ? "Os pares mudaram depois da análise. Analise novamente na etapa 4."
        : "Analise a rodada na etapa 4 antes de aplicar.";
    }
    if (rodadaTemTexto && revisao.naoAnalisados.length > 0) {
      return `${revisao.naoAnalisados.length} documento(s) selecionado(s) não foram analisados. Analise novamente na etapa 4.`;
    }
    if (temRessalva && !confirmouRessalvas) {
      return "Confirme as ressalvas da revisão antes de aplicar.";
    }
    return "";
  })();

  const zipDownloadHref = `/api/pastas/${id}/uploads-corrigidos/download${
    selectedDocs.size > 0 ? `?ids=${Array.from(selectedDocs).join(",")}` : ""
  }`;
  const zipDownloadLabel = `Baixar ${selectedDocs.size > 0 ? "selecionados" : "tudo"} (ZIP)`;

  const docsComErro = useMemo(
    () => docs.filter((doc) => resultados[doc.id]?.status === "erro"),
    [docs, resultados]
  );

  /** Toda mudança de base ou de rodada vence a revisão anterior. */
  function invalidarAnalise() {
    setAnalises({});
    setAnaliseAssinatura(null);
    setConfirmouRessalvas(false);
    setAnaliseError("");
  }

  function toggleDoc(docId: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  function selecionarFiltrados() {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      docsFiltrados.forEach((doc) => next.add(doc.id));
      return next;
    });
  }

  function desselecionarTodos() {
    setSelectedDocs(new Set());
  }

  function selecionarComErro() {
    setSelectedDocs(new Set(docsComErro.map((doc) => doc.id)));
  }

  function toggleDetalhes(docId: string) {
    setDetalhesAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploading(true);
    setUploadMessage(`Enviando ${fileArray.length} arquivo(s)...`);
    try {
      const planRes = await fetch(`/api/pastas/${id}/uploads-corrigidos/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: fileArray.map((f) => f.name) }),
      });
      const plan = await readApiResponse<UploadSignPlan>(planRes, "Erro ao preparar envio dos arquivos");

      if (plan.mode === "direct") {
        const supabase = createClient(plan.supabaseUrl, plan.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i];
          const target = plan.uploads[i];
          const { error } = await supabase.storage
            .from(plan.bucket)
            .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type || undefined });
          if (error) throw new Error(`Erro no upload de ${file.name}: ${error.message}`);
        }
        const registerRes = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arquivos: plan.uploads.map((u) => ({ nomeArquivo: u.nomeArquivo, uploadPath: u.ref })),
          }),
        });
        await readApiResponse(registerRes, "Erro ao registrar arquivos enviados");
      } else {
        const formData = new FormData();
        fileArray.forEach((file) => formData.append("arquivos", file));
        const uploadRes = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
          method: "POST",
          body: formData,
        });
        await readApiResponse(uploadRes, "Erro ao enviar arquivos");
      }

      await carregarDocs();
      setUploadMessage(`${fileArray.length} arquivo(s) enviado(s).`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Erro ao enviar arquivos");
    } finally {
      setUploading(false);
    }
  }

  // Nenhuma destas mexe na análise de propósito: quem decide se ela vale é a
  // comparação de assinatura. Assim, adicionar um par vazio não descarta a revisão,
  // e desfazer uma edição volta a valê-la — o que uma invalidação manual perderia.
  function addPar() {
    setPares((prev) => [...prev, { de: "", para: "" }]);
  }

  function removePar(index: number) {
    setPares((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePar(index: number, field: keyof Par, value: string) {
    setPares((prev) => prev.map((par, i) => (i === index ? { ...par, [field]: value } : par)));
  }

  /**
   * Etapa 4: conta, sem alterar nada, o que a rodada faria em cada documento
   * selecionado. Um documento por chamada, como o aplicar, para o operador ver
   * progresso real em pastas grandes. A falha de um documento não interrompe os
   * outros — ela vira uma linha da revisão.
   */
  async function analisar() {
    if (selectedDocs.size === 0) {
      setAnaliseError("Selecione ao menos um documento na etapa 2.");
      return;
    }
    if (paresValidos.length === 0) {
      setAnaliseError(
        "Informe ao menos um par na etapa 3. Rodada só de logo não tem contagem para revisar."
      );
      return;
    }

    const docIds = Array.from(selectedDocs);
    setAnalisando(true);
    setAnaliseError("");
    setConfirmouRessalvas(false);
    setAnaliseDone(0);
    setAnaliseTotal(docIds.length);

    const proximas: Record<string, AnaliseEntrada> = {};

    for (const docId of docIds) {
      try {
        const res = await fetch(`/api/pastas/${id}/uploads-corrigidos/preflight`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId, substituicoes: paresValidos }),
        });
        const plano = await readApiResponse<AnalisePlano>(res, "Falha ao analisar o documento");
        proximas[docId] = { ok: true, plano };
      } catch (error) {
        proximas[docId] = {
          ok: false,
          erro: error instanceof Error ? error.message : "Falha ao analisar o documento",
        };
      }
      setAnalises({ ...proximas });
      setAnaliseDone((n) => n + 1);
    }

    setAnaliseAssinatura(assinaturaDaRodada(paresValidos));
    setAnalisando(false);
  }

  // Processes one document per request (not the whole batch in a single call).
  // This gives real per-document progress and, on folders with many documents,
  // avoids a single request running long enough to hit the serverless function
  // time limit with no feedback at all — the same resilience pattern used by
  // the main "Gerar documentos" flow: one automatic retry on transient gateway
  // errors, defensive JSON parsing, and a failure on one document never stops
  // the rest of the batch.
  async function aplicar() {
    if (bloqueioAplicar) {
      setApplyError(bloqueioAplicar);
      return;
    }

    const docIds = Array.from(selectedDocs);
    const TRANSIENT_STATUS = [502, 503, 504, 408];

    setApplying(true);
    setApplyError("");
    setApplySummary("");
    setBatchDone(0);
    setBatchTotal(docIds.length);

    const nextResultados: Record<string, ResultadoRodada> = { ...resultados };
    let processados = 0;
    let comErro = 0;
    let desatualizados = 0;

    try {
      if (logoFile) {
        const logoFormData = new FormData();
        logoFormData.append("logo", logoFile);
        const logoResponse = await fetch(`/api/pastas/${id}/logo`, {
          method: "POST",
          body: logoFormData,
        });
        await readApiResponse(logoResponse, "Nao foi possivel salvar a nova logo como logo principal da pasta.");
      }

      for (const docId of docIds) {
        const doc = docs.find((d) => d.id === docId);
        setCurrentDocName(doc?.nomeArquivo || "");
        setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, status: "processando" } : d)));

        let resultado: ({ docId: string } & ResultadoRodada) | null = null;
        let erroLocal: string | null = null;

        try {
          const formData = new FormData();
          formData.append("docId", docId);
          formData.append("substituicoes", JSON.stringify(paresValidos));
          if (logoFile) formData.append("logo", logoFile);
          // O hash da análise é o que torna a trava de base divergente efetiva:
          // se o arquivo mudou entre revisar e aplicar, o servidor recusa com 409
          // em vez de aplicar sobre números que o operador nunca viu.
          const analise = analises[docId];
          if (analise?.ok) formData.append("hashOrigem", analise.plano.hashOrigem);

          let res: Response;
          let rawBody: string;
          let attempt = 0;
          while (true) {
            res = await fetch(`/api/pastas/${id}/uploads-corrigidos/aplicar`, { method: "POST", body: formData });
            rawBody = await res.text();
            if (res.ok || !TRANSIENT_STATUS.includes(res.status) || attempt >= 1) break;
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          let parsed: (({ docId: string } & ResultadoRodada) & { error?: string }) | null = null;
          try {
            parsed = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            parsed = null;
          }

          if (res.status === 409) {
            desatualizados++;
            erroLocal =
              parsed?.error ||
              "O documento mudou desde a análise. Analise novamente antes de aplicar.";
          } else if (!res.ok || !parsed) {
            erroLocal = TRANSIENT_STATUS.includes(res.status)
              ? `Tempo excedido${attempt > 0 ? " mesmo após nova tentativa" : ""}. Tente este documento sozinho.`
              : parsed?.error || `Falha ao aplicar (HTTP ${res.status}).`;
          } else {
            resultado = { ...parsed, docId };
          }
        } catch (err) {
          erroLocal = err instanceof Error ? err.message : "Erro de rede ao aplicar.";
        }

        if (resultado) {
          nextResultados[docId] = {
            status: resultado.status,
            aplicadas: resultado.aplicadas,
            naoEncontradas: resultado.naoEncontradas,
            logoSubstituida: resultado.logoSubstituida,
            contagens: resultado.contagens,
            erro: resultado.erro,
          };
          if (resultado.status === "erro") comErro++; else processados++;
        } else {
          nextResultados[docId] = { status: "erro", erro: erroLocal || "Erro desconhecido" };
          comErro++;
        }
        setResultados({ ...nextResultados });

        setDocs((prev) =>
          prev.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  status: resultado?.status ?? "erro",
                  mensagemErro: resultado?.erro ?? erroLocal ?? null,
                }
              : d
          )
        );
        setBatchDone((n) => n + 1);
      }

      const partes = [`${processados} processado(s)`];
      if (comErro > 0) partes.push(`${comErro} com erro`);
      if (desatualizados > 0) partes.push(`${desatualizados} recusado(s) por base desatualizada`);
      setApplySummary(`${partes.join(", ")}.`);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "Erro ao aplicar as correcoes.");
    } finally {
      setCurrentDocName("");
      setApplying(false);
      // A base de todo documento tocado mudou: a revisão descreve o passado.
      // Uma nova rodada exige analisar de novo, e é isso que mantém a trava viva.
      invalidarAnalise();
      await carregarDocs();
    }
  }

  async function visualizarDocumento(doc: DocumentoUploadItem, versaoId?: string) {
    const title = versaoId ? `${doc.nomeArquivo} - versão anterior` : doc.nomeArquivo;
    setPreview({ title, html: "", loading: true });
    try {
      const query = versaoId ? `?versaoId=${encodeURIComponent(versaoId)}` : "";
      const response = await fetch(`/api/pastas/${id}/uploads-corrigidos/${doc.id}/preview${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar preview");
      setPreview({ title, html: data.html || "", loading: false });
    } catch (error) {
      setPreview({
        title,
        html: "",
        loading: false,
        error: error instanceof Error ? error.message : "Falha ao carregar preview",
      });
    }
  }

  /**
   * Etapa 5: desfaz uma rodada voltando a base para o upload original ou para uma
   * versão intermediária. Não apaga nada — a saída vigente continua baixável como
   * versão anterior, então restaurar também é reversível.
   */
  async function restaurar(doc: DocumentoUploadItem, alvo: "original" | "versao", versaoId?: string) {
    const rotulo = alvo === "original" ? "o arquivo original enviado" : "esta versão anterior";
    const confirmado = window.confirm(
      `Restaurar "${doc.nomeArquivo}" para ${rotulo}?\n\n` +
        "Nada é apagado: a saída atual continua disponível como versão anterior, e restaurar " +
        "cria uma versão nova. Depois de restaurar é preciso analisar novamente antes de aplicar."
    );
    if (!confirmado) return;

    setRestaurandoId(doc.id);
    setRestauracaoMensagem("");
    try {
      const res = await fetch(`/api/pastas/${id}/uploads-corrigidos/${doc.id}/restaurar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alvo, versaoId }),
      });
      await readApiResponse(res, "Erro ao restaurar documento");
      setResultados((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      invalidarAnalise();
      await carregarDocs();
      setRestauracaoMensagem(
        `"${doc.nomeArquivo}" restaurado para ${rotulo}. Analise novamente antes da próxima rodada.`
      );
    } catch (error) {
      setRestauracaoMensagem(
        error instanceof Error ? error.message : "Erro ao restaurar documento"
      );
    } finally {
      setRestaurandoId(null);
    }
  }

  async function removerDocumento(doc: DocumentoUploadItem) {
    if (!window.confirm(`Remover "${doc.nomeArquivo}" deste lote?`)) return;
    setRemovingId(doc.id);
    try {
      const res = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id }),
      });
      await readApiResponse(res, "Erro ao remover documento");
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setSelectedDocs((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Erro ao remover documento");
    } finally {
      setRemovingId(null);
    }
  }

  async function removerSelecionados() {
    const ids = Array.from(selectedDocs);
    const selectedIds = new Set(ids);
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} documento(s) selecionado(s) deste lote?`)) return;

    setRemovingBatch(true);
    setUploadMessage("");
    try {
      const res = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await readApiResponse<{ removidos: number }>(res, "Erro ao excluir os documentos selecionados");
      setDocs((prev) => prev.filter((doc) => !selectedIds.has(doc.id)));
      setSelectedDocs(new Set());
      setUploadMessage(`${result.removidos} documento(s) excluido(s) do lote.`);
    } catch (error) {
      setUploadMessage(
        error instanceof Error
          ? `${error.message} Atualize a lista e tente novamente.`
          : "Erro ao excluir os documentos selecionados. Atualize a lista e tente novamente."
      );
    } finally {
      setRemovingBatch(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <ScrollToTopButton />
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corrigir documentos em lote</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Suba os .docx já finalizados (com suas edições manuais preservadas) e troque logo e dados
            comerciais em vários de uma vez, sem abrir um por um no Word.
          </p>
        </div>
        <Link href={`/pasta/${id}`} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          Voltar para a pasta
        </Link>
      </div>

      {/* 1. Upload */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6 p-5">
        <h2 className="font-semibold text-gray-800 mb-2">1. Enviar documentos finalizados</h2>
        <p className="text-xs text-gray-500 mb-3">
          Pode subir quantos .docx quiser de uma vez — são os arquivos reais, com logo e texto já preenchidos.
        </p>
        <input
          type="file"
          accept=".docx"
          multiple
          disabled={uploading}
          onChange={(e) => { void handleUpload(e.target.files); e.target.value = ""; }}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-50"
        />
        <p aria-live="polite" className="text-xs text-gray-600 mt-2 empty:mt-0">
          {uploadMessage}
        </p>
      </div>

      {/* 2. Selection + filter */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-800">2. Selecionar documentos</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{selectedDocs.size} selecionado(s) de {docs.length}</span>
            {docs.length > 0 && (
              <a href={zipDownloadHref} className="text-xs font-medium text-green-700 hover:underline shrink-0">
                {zipDownloadLabel}
              </a>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome (ex: POP, TCLE, MANUAL...)"
            className="w-full sm:max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="flex gap-2 items-center shrink-0">
            <button
              onClick={selecionarFiltrados}
              disabled={removingBatch}
              className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              Selecionar {normalizedSearch ? "filtrados" : "todos"}
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={desselecionarTodos}
              disabled={removingBatch}
              className="text-xs text-gray-500 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              Nenhum
            </button>
            {docsComErro.length > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  onClick={selecionarComErro}
                  disabled={removingBatch || applying || analisando}
                  className="text-xs font-medium text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  Só os {docsComErro.length} com erro
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { void removerSelecionados(); }}
              disabled={selectedDocs.size === 0 || removingBatch || applying}
              className="ml-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
            >
              {removingBatch ? "Excluindo..." : `Excluir selecionados (${selectedDocs.size})`}
            </button>
          </div>
        </div>

        {loading && <p className="px-5 py-6 text-sm text-gray-500">Carregando...</p>}
        {!loading && docs.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-600">Nenhum documento enviado ainda.</p>
        )}
        {!loading && docs.length > 0 && docsFiltrados.length === 0 && (
          <p className="px-5 py-6 text-sm text-gray-600">Nenhum documento encontrado para esse filtro.</p>
        )}

        <ul className="divide-y divide-gray-100">
          {docsFiltrados.map((doc) => {
            const resultado = resultados[doc.id];
            const versoesAnteriores = doc.versoes.filter((v) => v.outputPath !== doc.outputPath);
            const rotuloStatus = STATUS_DOC_LABEL[doc.status];
            const restaurando = restaurandoId === doc.id;
            return (
              <li key={doc.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    aria-label={`Selecionar ${doc.nomeArquivo}`}
                    disabled={removingBatch}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0"
                  />
                  <span className="min-w-[16rem] flex-[1_1_24rem] text-sm text-gray-900 break-words">
                    {doc.nomeArquivo}
                  </span>
                  {rotuloStatus && (
                    <span
                      className={`text-xs font-medium shrink-0 ${rotuloStatus.classe}`}
                      title={doc.status === "erro" ? doc.mensagemErro || "" : undefined}
                    >
                      {rotuloStatus.texto}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { void visualizarDocumento(doc); }}
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    Visualizar
                  </button>
                  <a
                    href={`/api/pastas/${id}/uploads-corrigidos/${doc.id}/download`}
                    className="text-xs text-blue-600 hover:underline shrink-0"
                  >
                    Baixar
                  </a>
                  {doc.outputPath && (
                    <button
                      type="button"
                      onClick={() => { void restaurar(doc, "original"); }}
                      disabled={restaurando || applying || analisando || removingBatch}
                      className="text-xs text-amber-700 hover:underline disabled:text-gray-400 shrink-0"
                      title="Volta este documento para o arquivo original enviado, sem apagar as correções feitas"
                    >
                      {restaurando ? "Restaurando..." : "Restaurar original"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { void removerDocumento(doc); }}
                    disabled={removingId === doc.id || removingBatch || applying}
                    className="text-xs text-red-500 hover:underline disabled:text-gray-400 shrink-0"
                  >
                    Remover
                  </button>
                </div>

                {resultado && (
                  <div className="ml-7 mt-2 flex flex-wrap gap-2">
                    {resultado.status === "erro" && (
                      <span className="text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
                        Erro: {resultado.erro}
                      </span>
                    )}
                    {resultado.logoSubstituida && (
                      <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                        ✓ Logo trocada
                      </span>
                    )}
                    {resultado.aplicadas?.map((valor) => {
                      const contagem = resultado.contagens?.find((c) => c.de === valor);
                      return (
                        <span key={`ok-${valor}`} className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                          ✓ &quot;{valor}&quot; aplicado
                          {contagem ? ` (${contagem.total}x)` : ""}
                        </span>
                      );
                    })}
                    {resultado.naoEncontradas?.map((valor) => (
                      <span key={`miss-${valor}`} className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                        ! &quot;{valor}&quot; não encontrado
                      </span>
                    ))}
                  </div>
                )}

                {versoesAnteriores.length > 0 && (
                  <details className="ml-7 mt-2 text-xs text-gray-600">
                    <summary className="cursor-pointer text-blue-700">Versões anteriores ({versoesAnteriores.length})</summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {versoesAnteriores.map((versao) => (
                        <span key={versao.id} className="inline-flex flex-wrap items-center gap-2 border border-gray-200 bg-gray-50 px-2.5 py-1 rounded">
                          <span className="text-gray-500">{new Date(versao.criadaEm).toLocaleString("pt-BR")}</span>
                          <button
                            type="button"
                            onClick={() => { void visualizarDocumento(doc, versao.id); }}
                            className="text-blue-700 hover:underline"
                          >
                            Visualizar
                          </button>
                          <a
                            href={`/api/pastas/${id}/uploads-corrigidos/${doc.id}/download?versaoId=${versao.id}`}
                            className="text-blue-700 hover:underline"
                          >
                            Baixar
                          </a>
                          <button
                            type="button"
                            onClick={() => { void restaurar(doc, "versao", versao.id); }}
                            disabled={restaurando || applying || analisando || removingBatch}
                            className="text-amber-700 hover:underline disabled:text-gray-400"
                          >
                            Restaurar esta
                          </button>
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>

        {docs.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex justify-end">
            <a
              href={zipDownloadHref}
              className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg px-4 py-2"
            >
              {zipDownloadLabel}
            </a>
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {restauracaoMensagem}
      </p>
      {restauracaoMensagem && (
        <p className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {restauracaoMensagem}
        </p>
      )}

      {/* 3. Define round */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">3. Definir a rodada</h2>
        <p className="text-xs text-gray-500 mb-4">
          Informe o valor antigo e o novo de cada dado que muda (razão social, CNPJ, nome do RT, endereço,
          telefone, e-mail...). Só troca o que você indicar — o resto do documento fica intacto. Se um
          valor não for encontrado em algum documento, ele aparece marcado como &quot;não encontrado&quot;,
          sem alterar o arquivo.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {pares.map((par, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={par.de}
                onChange={(e) => updatePar(index, "de", e.target.value)}
                aria-label={`Valor antigo do par ${index + 1}`}
                placeholder="Valor antigo (ex: Razão Social Ltda)"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="text"
                value={par.para}
                onChange={(e) => updatePar(index, "para", e.target.value)}
                aria-label={`Valor novo do par ${index + 1}`}
                placeholder="Valor novo"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {pares.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePar(index)}
                  className="text-xs text-red-500 hover:underline shrink-0 px-2"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addPar} className="text-xs text-blue-600 hover:underline mb-4">
          + Adicionar par
        </button>

        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-800 mb-1" htmlFor="logo-nova">
            Trocar logo (opcional)
          </label>
          <input
            id="logo-nova"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          {logoFile && <p className="text-xs text-gray-500 mt-1">{logoFile.name}</p>}
        </div>
      </div>

      {/* 4. Review */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">4. Revisar o que vai mudar</h2>
        <p className="text-xs text-gray-500 mb-4">
          A análise abre cada documento selecionado e conta as ocorrências sem alterar nada. Depois de
          revisar, aplicar usa exatamente estes números — se algum arquivo mudar nesse meio-tempo, a
          aplicação é recusada em vez de agir sobre uma contagem vencida.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { void analisar(); }}
            disabled={analisando || applying}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {analisando
              ? `Analisando... ${analiseDone}/${analiseTotal}`
              : `Analisar ${selectedDocs.size} selecionado(s)`}
          </button>
          {analiseValida && !analisando && (
            <span className="text-xs text-gray-500">
              {revisao.totalOcorrencias} ocorrência(s) em {docsSelecionados.length - revisao.naoAnalisados.length} documento(s)
            </span>
          )}
        </div>

        <div aria-live="polite">
          {analiseError && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {analiseError}
            </p>
          )}
          {analiseVencida && !analisando && (
            <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Os pares mudaram depois da última análise. Analise novamente — os números anteriores
              descrevem outra rodada.
            </p>
          )}
        </div>

        {analisando && (
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gray-900 transition-all"
                style={{ width: `${analiseTotal > 0 ? Math.round((analiseDone / analiseTotal) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {analiseValida && !analisando && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Contagem de ocorrências por par de substituição</caption>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th scope="col" className="py-2 pr-3 font-medium">Valor antigo</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Valor novo</th>
                    <th scope="col" className="py-2 pr-3 font-medium text-right">Ocorrências</th>
                    <th scope="col" className="py-2 font-medium text-right">Documentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumoPorPar.map((par, indice) => (
                    <tr key={`${par.de}-${indice}`} className={par.total === 0 ? "text-amber-700" : "text-gray-800"}>
                      <th scope="row" className="py-2 pr-3 font-normal break-words">{par.de}</th>
                      <td className="py-2 pr-3 break-words">
                        {par.para || <span className="text-gray-400 italic">(vazio — remove o texto)</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{par.total}</td>
                      <td className="py-2 text-right tabular-nums">{par.documentosAfetados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {docsSelecionados.map((doc) => {
                const entrada = analises[doc.id];
                const aberto = detalhesAbertos.has(doc.id);
                return (
                  <li key={doc.id} className="py-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => toggleDetalhes(doc.id)}
                        aria-expanded={aberto}
                        className="text-left font-medium text-blue-700 hover:underline break-words"
                      >
                        {aberto ? "▾" : "▸"} {doc.nomeArquivo}
                      </button>
                      {!entrada && <span className="text-xs text-gray-500">não analisado</span>}
                      {entrada && !entrada.ok && (
                        <span className="text-xs text-red-700">falha na análise: {entrada.erro}</span>
                      )}
                      {entrada?.ok && (
                        <>
                          <span
                            className={`text-xs ${entrada.plano.totalOcorrencias === 0 ? "text-amber-700" : "text-gray-600"}`}
                          >
                            {entrada.plano.totalOcorrencias} ocorrência(s)
                          </span>
                          {entrada.plano.baseCorrigida && (
                            <span className="text-xs text-gray-500" title="A rodada parte da última correção, não do arquivo original">
                              sobre correção anterior
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {aberto && entrada?.ok && (
                      <div className="mt-2 ml-4 flex flex-col gap-2">
                        {entrada.plano.substituicoes.map((sub, indice) => (
                          <div key={`${doc.id}-${indice}`} className="text-xs">
                            <p className={sub.total === 0 ? "text-amber-700" : "text-gray-700"}>
                              <span className="font-medium">{sub.de}</span> → {sub.para || "(vazio)"} ·{" "}
                              {sub.total} ocorrência(s)
                              {sub.total > 0 && (
                                <> ({sub.corpo} no corpo, {sub.cabecalho} no cabeçalho, {sub.rodape} no rodapé)</>
                              )}
                            </p>
                            {sub.ocorrencias.slice(0, 3).map((ocorrencia, i) => (
                              <p key={i} className="mt-0.5 text-gray-500 break-words">
                                {ESCOPO_LABEL[ocorrencia.escopo]}: {ocorrencia.contexto}
                              </p>
                            ))}
                            {sub.ocorrencias.length > 3 && (
                              <p className="mt-0.5 text-gray-400">
                                e outras {sub.ocorrencias.length - 3} ocorrência(s)
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {temRessalva && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Revise antes de aplicar</p>
                <ul className="mt-1 list-disc pl-5 text-xs flex flex-col gap-1">
                  {revisao.semOcorrencia.length > 0 && (
                    <li>
                      {revisao.semOcorrencia.length} documento(s) sem nenhuma ocorrência — aplicar não
                      muda nada neles: {revisao.semOcorrencia.slice(0, 5).join(", ")}
                      {revisao.semOcorrencia.length > 5 && ` e outros ${revisao.semOcorrencia.length - 5}`}.
                    </li>
                  )}
                  {revisao.excessivas.map((item, i) => (
                    <li key={`exc-${i}`}>
                      &quot;{item.de}&quot; casa {item.total} vezes em {item.nome} — mais que o esperado
                      para um dado comercial. Confira se o trecho não é genérico.
                    </li>
                  ))}
                  {revisao.falharam.map((item, i) => (
                    <li key={`fail-${i}`}>
                      {item.nome} não pôde ser analisado ({item.erro}) e será pulado.
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-start gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={confirmouRessalvas}
                    onChange={(e) => setConfirmouRessalvas(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-700"
                  />
                  Revisei as ressalvas acima e quero aplicar assim mesmo.
                </label>
              </div>
            )}

            {revisao.sobreCorrecao.length > 0 && (
              <p className="text-xs text-gray-500">
                {revisao.sobreCorrecao.length} documento(s) já tinham correção anterior, então esta
                rodada é cumulativa sobre ela. Para partir do arquivo original, use
                &quot;Restaurar original&quot; na etapa 2 antes de aplicar.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 5. Apply */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6 p-5">
        <h2 className="font-semibold text-gray-800 mb-1">5. Aplicar e baixar</h2>
        <p className="text-xs text-gray-500 mb-4">
          Cada documento é processado numa chamada própria, então uma falha isolada não interrompe o
          lote. A saída anterior nunca é sobrescrita: cada rodada cria uma versão nova, e a etapa 2
          permite voltar a qualquer uma delas.
        </p>

        <div aria-live="polite">
          {applyError && (
            <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {applyError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { void aplicar(); }}
            disabled={applying || analisando || !!bloqueioAplicar}
            title={bloqueioAplicar || undefined}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {applying ? `Aplicando... ${batchDone}/${batchTotal}` : `Aplicar aos ${selectedDocs.size} selecionado(s)`}
          </button>
          {docsComErro.length > 0 && !applying && (
            <button
              type="button"
              onClick={selecionarComErro}
              disabled={analisando}
              className="border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
            >
              Selecionar só os {docsComErro.length} com erro
            </button>
          )}
        </div>

        {bloqueioAplicar && !applying && (
          <p className="mt-2 text-xs text-gray-500">{bloqueioAplicar}</p>
        )}

        {applying && (
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0}%` }}
              />
            </div>
            <p aria-live="polite" className="text-xs text-gray-500 mt-1 empty:mt-0">
              {currentDocName && `Processando: ${currentDocName}`}
            </p>
          </div>
        )}

        <div aria-live="polite">
          {!applying && applySummary && (
            <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              {applySummary}
            </p>
          )}
        </div>

        {docs.length > 0 && (
          <a
            href={zipDownloadHref}
            className="mt-4 inline-block text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg px-4 py-2"
          >
            {zipDownloadLabel}
          </a>
        )}
      </div>

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
