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

interface ResultadoRodada {
  status: "processado" | "erro";
  aplicadas?: string[];
  naoEncontradas?: string[];
  logoSubstituida?: boolean;
  erro?: string;
}

type UploadSignPlan =
  | { mode: "multipart" }
  | {
      mode: "direct";
      supabaseUrl: string;
      supabaseAnonKey: string;
      bucket: string;
      uploads: Array<{ nomeArquivo: string; path: string; token: string; ref: string }>;
    };

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  const [applying, setApplying] = useState(false);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [currentDocName, setCurrentDocName] = useState("");
  const [resultados, setResultados] = useState<Record<string, ResultadoRodada>>({});
  const [applyError, setApplyError] = useState("");
  const [applySummary, setApplySummary] = useState("");
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  const zipDownloadHref = `/api/pastas/${id}/uploads-corrigidos/download${
    selectedDocs.size > 0 ? `?ids=${Array.from(selectedDocs).join(",")}` : ""
  }`;
  const zipDownloadLabel = `Baixar ${selectedDocs.size > 0 ? "selecionados" : "tudo"} (ZIP)`;

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

  function addPar() {
    setPares((prev) => [...prev, { de: "", para: "" }]);
  }

  function removePar(index: number) {
    setPares((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePar(index: number, field: keyof Par, value: string) {
    setPares((prev) => prev.map((par, i) => (i === index ? { ...par, [field]: value } : par)));
  }

  // Processes one document per request (not the whole batch in a single call).
  // This gives real per-document progress and, on folders with many documents,
  // avoids a single request running long enough to hit the serverless function
  // time limit with no feedback at all — the same resilience pattern used by
  // the main "Gerar documentos" flow: one automatic retry on transient gateway
  // errors, defensive JSON parsing, and a failure on one document never stops
  // the rest of the batch.
  async function aplicar() {
    const paresValidos = pares.filter((p) => p.de.trim().length > 0);
    if (selectedDocs.size === 0) {
      setApplyError("Selecione ao menos um documento.");
      return;
    }
    if (paresValidos.length === 0 && !logoFile) {
      setApplyError("Informe uma logo nova e/ou ao menos um par de substituição.");
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

    try {
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

          if (!res.ok || !parsed) {
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

      setApplySummary(
        comErro > 0
          ? `${processados} processado(s), ${comErro} com erro.`
          : `${processados} documento(s) processado(s) com sucesso.`
      );
    } finally {
      setCurrentDocName("");
      setApplying(false);
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

      {/* Upload */}
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
        {uploadMessage && <p className="text-xs text-gray-600 mt-2">{uploadMessage}</p>}
      </div>

      {/* Selection + filter */}
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
            <button onClick={selecionarFiltrados} className="text-xs text-blue-600 hover:underline">
              Selecionar {normalizedSearch ? "filtrados" : "todos"}
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={desselecionarTodos} className="text-xs text-gray-500 hover:underline">Nenhum</button>
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
            return (
              <li key={doc.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0"
                  />
                  <span className="min-w-[16rem] flex-[1_1_24rem] text-sm text-gray-900 break-words">
                    {doc.nomeArquivo}
                  </span>
                  {doc.status === "processado" && (
                    <span className="text-xs font-medium text-green-600 shrink-0">Processado</span>
                  )}
                  {doc.status === "erro" && (
                    <span className="text-xs font-medium text-red-500 shrink-0" title={doc.mensagemErro || ""}>
                      Erro
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
                  <button
                    type="button"
                    onClick={() => { void removerDocumento(doc); }}
                    disabled={removingId === doc.id}
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
                    {resultado.aplicadas?.map((valor) => (
                      <span key={`ok-${valor}`} className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                        ✓ &quot;{valor}&quot; aplicado
                      </span>
                    ))}
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      {versoesAnteriores.map((versao) => (
                        <span key={versao.id} className="inline-flex items-center gap-2 border border-gray-200 bg-gray-50 px-2.5 py-1 rounded">
                          <button
                            type="button"
                            onClick={() => { void visualizarDocumento(doc, versao.id); }}
                            className="text-blue-700 hover:underline"
                          >
                            Visualizar
                          </button>
                          <a
                            href={`/api/pastas/${id}/uploads-corrigidos/${doc.id}/download?versaoId=${versao.id}`}
                            className="hover:underline"
                          >
                            {new Date(versao.criadaEm).toLocaleString("pt-BR")}
                          </a>
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

      {/* Define round */}
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
                placeholder="Valor antigo (ex: Razão Social Ltda)"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="text"
                value={par.para}
                onChange={(e) => updatePar(index, "para", e.target.value)}
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
          <label className="block text-sm font-medium text-gray-800 mb-1">Trocar logo (opcional)</label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          {logoFile && <p className="text-xs text-gray-500 mt-1">{logoFile.name}</p>}
        </div>

        {applyError && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {applyError}
          </p>
        )}

        <button
          type="button"
          onClick={() => { void aplicar(); }}
          disabled={applying}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {applying ? `Aplicando... ${batchDone}/${batchTotal}` : `Aplicar aos ${selectedDocs.size} selecionado(s)`}
        </button>

        {applying && (
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0}%` }}
              />
            </div>
            {currentDocName && (
              <p className="text-xs text-gray-500 mt-1">Processando: {currentDocName}</p>
            )}
          </div>
        )}

        {!applying && applySummary && (
          <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            {applySummary}
          </p>
        )}
      </div>

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
