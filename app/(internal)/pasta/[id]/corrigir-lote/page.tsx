"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fieldClass } from "@/components/ui/Field";
import { Card, CardHeader, PageHeader } from "@/components/ui/Surface";
import {
  describeErrorOrigin,
  Feedback,
  ProgressBar,
  StatusBadge,
  UPLOAD_STATUS,
} from "@/components/ui/Status";
import { normalizeForMatch } from "@/components/ui/text";

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

interface Confirmacao {
  title: string;
  description: string;
  confirmLabel: string;
  destrutiva: boolean;
  onConfirm: () => void;
}

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
  const [uploadErro, setUploadErro] = useState(false);
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
  const [restauracaoErro, setRestauracaoErro] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

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
    if (selectedDocs.size === 0) return "Selecione ao menos um documento na etapa 2.";
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
  const zipDownloadLabel = `Baixar ${selectedDocs.size > 0 ? "selecionados" : "tudo"} em ZIP`;

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
    setUploadErro(false);
    setUploadMessage(`Enviando ${fileArray.length} arquivo(s)...`);
    try {
      const planRes = await fetch(`/api/pastas/${id}/uploads-corrigidos/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: fileArray.map((f) => f.name) }),
      });
      const plan = await readApiResponse<UploadSignPlan>(planRes, "Erro ao preparar o upload dos arquivos");

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
        await readApiResponse(registerRes, "O banco recusou o registro dos arquivos enviados");
      } else {
        const formData = new FormData();
        fileArray.forEach((file) => formData.append("arquivos", file));
        const uploadRes = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
          method: "POST",
          body: formData,
        });
        await readApiResponse(uploadRes, "Erro no upload dos arquivos");
      }

      await carregarDocs();
      setUploadMessage(`${fileArray.length} arquivo(s) enviado(s).`);
    } catch (error) {
      setUploadErro(true);
      setUploadMessage(error instanceof Error ? error.message : "Erro no upload dos arquivos");
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

  // Um documento por requisição (não o lote inteiro numa chamada só). Isso dá
  // progresso real por documento e, em pastas grandes, evita uma requisição longa
  // o bastante para bater no limite de tempo da função sem nenhum retorno — o
  // mesmo padrão de resiliência do fluxo "Gerar documentos": uma nova tentativa
  // automática em erro transitório de gateway, leitura defensiva do JSON, e falha
  // de um documento nunca interrompe o resto do lote.
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
        await readApiResponse(logoResponse, "Não foi possível salvar a nova logo como logo principal da pasta.");
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
              ? `Tempo excedido${attempt > 0 ? ", mesmo após nova tentativa" : ""}. Tente este documento sozinho.`
              : parsed?.error || `Falha ao aplicar a correção (HTTP ${res.status}).`;
          } else {
            resultado = { ...parsed, docId };
          }
        } catch (err) {
          erroLocal = err instanceof Error ? err.message : "Erro de rede ao aplicar a correção.";
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
      setApplyError(error instanceof Error ? error.message : "Erro ao aplicar as correções.");
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
    const title = versaoId ? `${doc.nomeArquivo} — versão anterior` : doc.nomeArquivo;
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
    setRestaurandoId(doc.id);
    setRestauracaoMensagem("");
    setRestauracaoErro(false);
    try {
      const res = await fetch(`/api/pastas/${id}/uploads-corrigidos/${doc.id}/restaurar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alvo, versaoId }),
      });
      await readApiResponse(res, "Erro ao restaurar o documento");
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
      setRestauracaoErro(true);
      setRestauracaoMensagem(
        error instanceof Error ? error.message : "Erro ao restaurar o documento"
      );
    } finally {
      setRestaurandoId(null);
    }
  }

  function pedirRestauracao(doc: DocumentoUploadItem, alvo: "original" | "versao", versaoId?: string) {
    const rotulo = alvo === "original" ? "o arquivo original enviado" : "esta versão anterior";
    setConfirmacao({
      title: "Restaurar documento?",
      description:
        `"${doc.nomeArquivo}" volta para ${rotulo}. Nada é apagado: a saída atual continua ` +
        "disponível como versão anterior, e restaurar cria uma versão nova. Depois de restaurar é " +
        "preciso analisar novamente antes de aplicar.",
      confirmLabel: "Restaurar",
      destrutiva: false,
      onConfirm: () => {
        setConfirmacao(null);
        void restaurar(doc, alvo, versaoId);
      },
    });
  }

  async function removerDocumento(doc: DocumentoUploadItem) {
    setRemovingId(doc.id);
    setUploadErro(false);
    try {
      const res = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id }),
      });
      await readApiResponse(res, "O banco recusou a remoção do documento");
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setSelectedDocs((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
      setUploadMessage(`"${doc.nomeArquivo}" removido do lote.`);
    } catch (error) {
      setUploadErro(true);
      setUploadMessage(error instanceof Error ? error.message : "Erro ao remover o documento");
    } finally {
      setRemovingId(null);
    }
  }

  async function removerSelecionados() {
    const ids = Array.from(selectedDocs);
    const selectedIds = new Set(ids);
    if (ids.length === 0) return;

    setRemovingBatch(true);
    setUploadMessage("");
    setUploadErro(false);
    try {
      const res = await fetch(`/api/pastas/${id}/uploads-corrigidos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await readApiResponse<{ removidos: number }>(res, "O banco recusou a exclusão dos documentos selecionados");
      setDocs((prev) => prev.filter((doc) => !selectedIds.has(doc.id)));
      setSelectedDocs(new Set());
      setUploadMessage(`${result.removidos} documento(s) excluído(s) do lote.`);
    } catch (error) {
      setUploadErro(true);
      setUploadMessage(
        error instanceof Error
          ? `${error.message} Atualize a lista e tente novamente.`
          : "Erro ao excluir os documentos selecionados. Atualize a lista e tente novamente."
      );
    } finally {
      setRemovingBatch(false);
    }
  }

  const analisePercent = analiseTotal > 0 ? Math.round((analiseDone / analiseTotal) * 100) : 0;
  const aplicaPercent = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <ScrollToTopButton />

      <PageHeader
        title="Corrigir documentos em lote"
        description="Envie os .docx já finalizados, com suas edições manuais preservadas, e troque logo e dados comerciais em vários de uma vez, sem abrir um por um no Word."
        actions={
          <Link href={`/pasta/${id}`} className={buttonClass("secondary")}>
            Voltar para a pasta
          </Link>
        }
      />

      {/* 1. Upload */}
      <Card className="mb-6">
        <CardHeader
          title="1. Enviar documentos finalizados"
          description="Suba quantos .docx quiser de uma vez — são os arquivos reais, com logo e texto já preenchidos."
        />
        <div className="px-4 py-4 sm:px-5">
          <label htmlFor="upload-docx" className="sr-only">
            Arquivos .docx finalizados
          </label>
          <input
            id="upload-docx"
            type="file"
            accept=".docx"
            multiple
            disabled={uploading}
            onChange={(e) => { void handleUpload(e.target.files); e.target.value = ""; }}
            className="block w-full rounded-md border border-gray-300 bg-surface-card p-1 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-accent"
          />
          <div aria-live="polite">
            {uploadMessage && (
              <Feedback
                tone={uploadErro ? "erro" : "info"}
                title={uploadErro ? describeErrorOrigin(uploadMessage).rotulo : undefined}
                className="mt-3"
              >
                {uploadMessage}
              </Feedback>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Seleção */}
      <Card className="mb-6">
        <CardHeader
          title="2. Selecionar documentos"
          meta={`${selectedDocs.size} de ${docs.length} selecionado(s)`}
          actions={
            docs.length > 0 ? (
              <a href={zipDownloadHref} className={buttonClass("secondary")}>
                {zipDownloadLabel}
              </a>
            ) : undefined
          }
        />

        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="w-full sm:max-w-md">
            <label htmlFor="filtro-documentos" className="sr-only">
              Filtrar documentos por nome
            </label>
            <input
              id="filtro-documentos"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome (POP, TCLE, MANUAL...)"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="quiet" disabled={removingBatch} onClick={selecionarFiltrados}>
              Selecionar {normalizedSearch ? "filtrados" : "todos"}
            </Button>
            <Button variant="quiet" disabled={removingBatch} onClick={desselecionarTodos}>
              Nenhum
            </Button>
            {docsComErro.length > 0 && (
              <Button
                variant="quiet"
                disabled={removingBatch || applying || analisando}
                onClick={selecionarComErro}
              >
                Só os {docsComErro.length} com erro
              </Button>
            )}
            <Button
              variant="danger"
              disabled={selectedDocs.size === 0 || removingBatch || applying}
              onClick={() =>
                setConfirmacao({
                  title: "Excluir do lote?",
                  description: `${selectedDocs.size} documento(s) selecionado(s) saem deste lote de correção. Os arquivos gerados pela pasta não são afetados.`,
                  confirmLabel: "Excluir do lote",
                  destrutiva: true,
                  onConfirm: () => {
                    setConfirmacao(null);
                    void removerSelecionados();
                  },
                })
              }
            >
              {removingBatch ? "Excluindo..." : `Excluir selecionados (${selectedDocs.size})`}
            </Button>
          </div>
        </div>

        {loading && <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">Carregando documentos...</p>}
        {!loading && docs.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">Nenhum documento enviado ainda.</p>
        )}
        {!loading && docs.length > 0 && docsFiltrados.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">
            Nenhum documento encontrado para esse filtro.
          </p>
        )}

        <ul className="divide-y divide-gray-200">
          {docsFiltrados.map((doc) => {
            const resultado = resultados[doc.id];
            const versoesAnteriores = doc.versoes.filter((v) => v.outputPath !== doc.outputPath);
            const docStatus = UPLOAD_STATUS[doc.status];
            const restaurando = restaurandoId === doc.id;
            return (
              <li key={doc.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    aria-label={`Selecionar ${doc.nomeArquivo}`}
                    disabled={removingBatch}
                    className="h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <span className="min-w-[16rem] flex-[1_1_24rem] break-words text-sm text-ink">
                    {doc.nomeArquivo}
                  </span>
                  {docStatus && <StatusBadge tone={docStatus.tone}>{docStatus.label}</StatusBadge>}
                  <Button
                    variant="quiet"
                    aria-label={`Visualizar ${doc.nomeArquivo}`}
                    onClick={() => {
                      void visualizarDocumento(doc);
                    }}
                  >
                    Visualizar
                  </Button>
                  <a
                    href={`/api/pastas/${id}/uploads-corrigidos/${doc.id}/download`}
                    aria-label={`Baixar ${doc.nomeArquivo}`}
                    className={buttonClass("quiet")}
                  >
                    Baixar
                  </a>
                  {doc.outputPath && (
                    <Button
                      variant="quiet"
                      disabled={restaurando || applying || analisando || removingBatch}
                      onClick={() => pedirRestauracao(doc, "original")}
                    >
                      {restaurando ? "Restaurando..." : "Restaurar original"}
                    </Button>
                  )}
                  <Button
                    variant="quiet"
                    disabled={removingId === doc.id || removingBatch || applying}
                    aria-label={`Remover ${doc.nomeArquivo} do lote`}
                    onClick={() =>
                      setConfirmacao({
                        title: "Remover do lote?",
                        description: `"${doc.nomeArquivo}" sai deste lote de correção. O arquivo gerado pela pasta não é afetado.`,
                        confirmLabel: "Remover",
                        destrutiva: true,
                        onConfirm: () => {
                          setConfirmacao(null);
                          void removerDocumento(doc);
                        },
                      })
                    }
                  >
                    Remover
                  </Button>
                </div>

                {doc.status === "erro" && doc.mensagemErro && (
                  <Feedback tone="erro" title={describeErrorOrigin(doc.mensagemErro).rotulo} className="mt-2">
                    {doc.mensagemErro}
                  </Feedback>
                )}

                {resultado && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {resultado.logoSubstituida && <StatusBadge tone="sucesso">Logo trocada</StatusBadge>}
                    {resultado.aplicadas?.map((valor) => {
                      const contagem = resultado.contagens?.find((c) => c.de === valor);
                      return (
                        <StatusBadge key={`ok-${valor}`} tone="sucesso">
                          {`"${valor}" aplicado${contagem ? ` (${contagem.total}x)` : ""}`}
                        </StatusBadge>
                      );
                    })}
                    {resultado.naoEncontradas?.map((valor) => (
                      <StatusBadge key={`miss-${valor}`} tone="atencao">
                        {`"${valor}" não encontrado`}
                      </StatusBadge>
                    ))}
                  </div>
                )}

                {versoesAnteriores.length > 0 && (
                  <details className="mt-2 text-sm text-ink-muted">
                    <summary className="cursor-pointer text-brand-accent">
                      Versões anteriores ({versoesAnteriores.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {versoesAnteriores.map((versao) => (
                        <li
                          key={versao.id}
                          className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-surface-subtle px-3 py-1"
                        >
                          <span>{new Date(versao.criadaEm).toLocaleString("pt-BR")}</span>
                          <Button
                            variant="quiet"
                            onClick={() => {
                              void visualizarDocumento(doc, versao.id);
                            }}
                          >
                            Visualizar
                          </Button>
                          <a
                            href={`/api/pastas/${id}/uploads-corrigidos/${doc.id}/download?versaoId=${versao.id}`}
                            className={buttonClass("quiet")}
                          >
                            Baixar
                          </a>
                          <Button
                            variant="quiet"
                            disabled={restaurando || applying || analisando || removingBatch}
                            onClick={() => pedirRestauracao(doc, "versao", versao.id)}
                          >
                            Restaurar esta
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <div aria-live="polite">
        {restauracaoMensagem && (
          <Feedback
            tone={restauracaoErro ? "erro" : "atencao"}
            title={restauracaoErro ? describeErrorOrigin(restauracaoMensagem).rotulo : undefined}
            className="mb-6"
          >
            {restauracaoMensagem}
          </Feedback>
        )}
      </div>

      {/* 3. Rodada */}
      <Card className="mb-6">
        <CardHeader
          title="3. Definir a rodada"
          description="Informe o valor antigo e o novo de cada dado que muda (razão social, CNPJ, nome do RT, endereço, telefone, e-mail). Só troca o que você indicar; o resto do documento fica intacto."
        />
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-col gap-2">
            {pares.map((par, index) => (
              <div key={index} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={par.de}
                  onChange={(e) => updatePar(index, "de", e.target.value)}
                  aria-label={`Valor antigo do par ${index + 1}`}
                  placeholder="Valor antigo (ex: Razão Social Ltda)"
                  className={fieldClass}
                />
                <input
                  type="text"
                  value={par.para}
                  onChange={(e) => updatePar(index, "para", e.target.value)}
                  aria-label={`Valor novo do par ${index + 1}`}
                  placeholder="Valor novo"
                  className={fieldClass}
                />
                {pares.length > 1 && (
                  <Button variant="danger" onClick={() => removePar(index)}>
                    Remover
                    <span className="sr-only">{` par ${index + 1}`}</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={addPar}>
            Adicionar par
          </Button>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="logo-nova">
              Trocar logo (opcional)
            </label>
            <input
              id="logo-nova"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="block w-full rounded-md border border-gray-300 bg-surface-card p-1 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-accent"
            />
            {logoFile && (
              <p className="mt-1 text-sm text-ink-muted">
                Logo selecionada: <span className="font-semibold text-ink">{logoFile.name}</span>
              </p>
            )}
          </div>

          <p className="mt-3 text-sm text-ink-muted">
            Se um valor não for encontrado em algum documento, ele aparece marcado como
            &quot;não encontrado&quot;, sem alterar o arquivo.
          </p>
        </div>
      </Card>

      {/* 4. Revisão */}
      <Card className="mb-6">
        <CardHeader
          title="4. Revisar o que vai mudar"
          description="A análise abre cada documento selecionado e conta as ocorrências sem alterar nada. Aplicar usa exatamente estes números — se algum arquivo mudar nesse meio-tempo, a aplicação é recusada."
        />
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={analisando || applying}
              onClick={() => {
                void analisar();
              }}
            >
              {analisando
                ? `Analisando ${analiseDone}/${analiseTotal}...`
                : `Analisar ${selectedDocs.size} selecionado(s)`}
            </Button>
            {analiseValida && !analisando && (
              <StatusBadge tone="info">
                {revisao.totalOcorrencias} ocorrência(s) em{" "}
                {docsSelecionados.length - revisao.naoAnalisados.length} documento(s)
              </StatusBadge>
            )}
          </div>

          <div aria-live="polite">
            {analiseError && (
              <Feedback tone="erro" title={describeErrorOrigin(analiseError).rotulo} className="mt-3">
                {analiseError}
              </Feedback>
            )}
            {analiseVencida && !analisando && (
              <Feedback tone="atencao" title="Análise vencida" className="mt-3">
                Os pares mudaram depois da última análise. Analise novamente — os números anteriores
                descrevem outra rodada.
              </Feedback>
            )}
          </div>

          {analisando && (
            <div className="mt-3">
              <ProgressBar value={analisePercent} label="Progresso da análise" />
            </div>
          )}

          {analiseValida && !analisando && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Contagem de ocorrências por par de substituição</caption>
                  <thead>
                    <tr className="text-left text-ink-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">Valor antigo</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Valor novo</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">Ocorrências</th>
                      <th scope="col" className="py-2 text-right font-semibold">Documentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {resumoPorPar.map((par, indice) => (
                      <tr key={`${par.de}-${indice}`} className="text-ink">
                        <th scope="row" className="break-words py-2 pr-3 text-left font-normal">
                          {par.de}
                        </th>
                        <td className="break-words py-2 pr-3">
                          {par.para || <span className="text-ink-subtle">(vazio — remove o texto)</span>}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {par.total === 0 ? (
                            <span className="font-semibold text-status-warning">0</span>
                          ) : (
                            par.total
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">{par.documentosAfetados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-gray-200 border-t border-gray-200">
                {docsSelecionados.map((doc) => {
                  const entrada = analises[doc.id];
                  const aberto = detalhesAbertos.has(doc.id);
                  return (
                    <li key={doc.id} className="py-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Button variant="quiet" aria-expanded={aberto} onClick={() => toggleDetalhes(doc.id)}>
                          <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
                          {doc.nomeArquivo}
                        </Button>
                        {!entrada && <StatusBadge tone="neutro">Não analisado</StatusBadge>}
                        {entrada && !entrada.ok && (
                          <StatusBadge tone="erro">Falha na análise: {entrada.erro}</StatusBadge>
                        )}
                        {entrada?.ok && (
                          <>
                            <StatusBadge tone={entrada.plano.totalOcorrencias === 0 ? "atencao" : "info"}>
                              {entrada.plano.totalOcorrencias} ocorrência(s)
                            </StatusBadge>
                            {entrada.plano.baseCorrigida && (
                              <StatusBadge tone="neutro">Sobre correção anterior</StatusBadge>
                            )}
                          </>
                        )}
                      </div>

                      {aberto && entrada?.ok && (
                        <div className="ml-4 mt-2 flex flex-col gap-2">
                          {entrada.plano.substituicoes.map((sub, indice) => (
                            <div key={`${doc.id}-${indice}`} className="text-sm">
                              <p className={sub.total === 0 ? "text-status-warning" : "text-ink"}>
                                <span className="font-semibold">{sub.de}</span> → {sub.para || "(vazio)"} ·{" "}
                                {sub.total} ocorrência(s)
                                {sub.total > 0 && (
                                  <> ({sub.corpo} no corpo, {sub.cabecalho} no cabeçalho, {sub.rodape} no rodapé)</>
                                )}
                              </p>
                              {sub.ocorrencias.slice(0, 3).map((ocorrencia, i) => (
                                <p key={i} className="mt-0.5 break-words text-ink-muted">
                                  {ESCOPO_LABEL[ocorrencia.escopo]}: {ocorrencia.contexto}
                                </p>
                              ))}
                              {sub.ocorrencias.length > 3 && (
                                <p className="mt-0.5 text-ink-subtle">
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
                <Feedback tone="atencao" title="Revise antes de aplicar">
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
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
                  <label className="mt-3 flex items-start gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={confirmouRessalvas}
                      onChange={(e) => setConfirmouRessalvas(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    Revisei as ressalvas acima e quero aplicar assim mesmo.
                  </label>
                </Feedback>
              )}

              {revisao.sobreCorrecao.length > 0 && (
                <p className="text-sm text-ink-muted">
                  {revisao.sobreCorrecao.length} documento(s) já tinham correção anterior, então esta
                  rodada é cumulativa sobre ela. Para partir do arquivo original, use
                  &quot;Restaurar original&quot; na etapa 2 antes de aplicar.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 5. Aplicar */}
      <Card className="mb-6">
        <CardHeader
          title="5. Aplicar e baixar"
          description="Cada documento é processado numa chamada própria, então uma falha isolada não interrompe o lote. A saída anterior nunca é sobrescrita: cada rodada cria uma versão nova, e a etapa 2 permite voltar a qualquer uma delas."
        />
        <div className="px-4 py-4 sm:px-5">
          <div aria-live="polite">
            {applyError && (
              <Feedback tone="erro" title={describeErrorOrigin(applyError).rotulo} className="mb-4">
                {applyError}
              </Feedback>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={applying || analisando || !!bloqueioAplicar}
              title={bloqueioAplicar || undefined}
              onClick={() => {
                void aplicar();
              }}
            >
              {applying
                ? `Aplicando ${batchDone}/${batchTotal}...`
                : `Aplicar aos ${selectedDocs.size} selecionado(s)`}
            </Button>
            {docsComErro.length > 0 && !applying && (
              <Button variant="secondary" disabled={analisando} onClick={selecionarComErro}>
                Selecionar só os {docsComErro.length} com erro
              </Button>
            )}
            {docs.length > 0 && (
              <a href={zipDownloadHref} className={buttonClass("secondary")}>
                {zipDownloadLabel}
              </a>
            )}
          </div>

          {bloqueioAplicar && !applying && (
            <p className="mt-2 text-sm text-ink-muted">{bloqueioAplicar}</p>
          )}

          {applying && (
            <div className="mt-3">
              <ProgressBar value={aplicaPercent} label="Progresso da aplicação" />
              <p aria-live="polite" className="mt-1 text-sm text-ink-muted empty:mt-0">
                {currentDocName && `Processando: ${currentDocName}`}
              </p>
            </div>
          )}

          <div aria-live="polite">
            {!applying && applySummary && (
              <Feedback tone="sucesso" title="Rodada concluída" className="mt-3">
                {applySummary}
              </Feedback>
            )}
          </div>
        </div>
      </Card>

      {confirmacao && (
        <ConfirmDialog
          title={confirmacao.title}
          description={confirmacao.description}
          confirmLabel={confirmacao.confirmLabel}
          destrutiva={confirmacao.destrutiva}
          onCancel={() => setConfirmacao(null)}
          onConfirm={confirmacao.onConfirm}
        />
      )}

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
