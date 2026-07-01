"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";

interface Pasta {
  id: string;
  status: string;
  criadaEm: string;
  clienteNomeFantasia: string | null;
  clienteRazaoSocial: string | null;
  clienteCnpj: string | null;
  clienteEstado: string | null;
  clienteCidade: string | null;
  clienteRtNome: string | null;
  documentos: Array<{
    id: string;
    nomeArquivo: string;
    status: string;
    tokensUsados: number | null;
    mensagemErro: string | null;
    templateId: string | null;
    outputPath: string | null;
    avisoRtNoCorpo: boolean;
    logoSubstituida: boolean;
    versoes: Array<{
      id: string;
      outputPath: string;
      criadaEm: string;
    }>;
  }>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "text-gray-600" },
  processando: { label: "Processando...", color: "text-yellow-600" },
  gerado: { label: "Gerado", color: "text-green-600" },
  erro: { label: "Erro", color: "text-red-600" },
};

const PASTA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-700 border-gray-200" },
  processando: { label: "Processando", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  concluida: { label: "Concluida", color: "bg-green-50 text-green-700 border-green-200" },
};

export default function PastaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);

  useEffect(() => {
    fetch(`/api/pastas/${id}`)
      .then((r) => r.json())
      .then(setPasta);
  }, [id]);

  if (!pasta) return <p className="text-gray-500">Carregando...</p>;

  const gerados = pasta.documentos.filter((d) => d.status === "gerado").length;
  const comErro = pasta.documentos.filter((d) => d.status === "erro").length;
  const pendentes = pasta.documentos.filter((d) => d.status === "pendente" || d.status === "processando").length;
  const semTemplate = pasta.documentos.filter((d) => !d.templateId).length;
  const camposPendentes = [
    !pasta.clienteNomeFantasia && "nome fantasia",
    !pasta.clienteCnpj && "CNPJ",
    !pasta.clienteEstado && "estado",
    !pasta.clienteCidade && "cidade",
    !pasta.clienteRtNome && "responsável técnico",
  ].filter(Boolean) as string[];
  const total = pasta.documentos.length;
  const prontaParaEntrega =
    total > 0 &&
    gerados === total &&
    comErro === 0 &&
    semTemplate === 0 &&
    camposPendentes.length === 0;
  const pastaStatus = PASTA_STATUS_LABELS[pasta.status] || PASTA_STATUS_LABELS.rascunho;
  const documentosOrdenados = [...pasta.documentos].sort((a, b) => {
    const aGerado = a.status === "gerado" ? 1 : 0;
    const bGerado = b.status === "gerado" ? 1 : 0;
    if (aGerado !== bGerado) return aGerado - bGerado;
    return a.nomeArquivo.localeCompare(b.nomeArquivo, "pt-BR", { sensitivity: "base" });
  });

  async function visualizarDocumento(doc: { id: string; nomeArquivo: string }, versaoId?: string) {
    const title = versaoId ? `${doc.nomeArquivo} - versao anterior` : doc.nomeArquivo;
    setPreview({ title, html: "", loading: true });
    try {
      const query = versaoId ? `?versaoId=${encodeURIComponent(versaoId)}` : "";
      const response = await fetch(`/api/pastas/${id}/documentos/${doc.id}/preview${query}`);
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

  async function atualizarStatus(status: "rascunho" | "concluida") {
    if (!pasta) return;
    setUpdatingStatus(true);
    const previous = pasta;
    setPasta({ ...pasta, status });
    try {
      const res = await fetch(`/api/pastas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      const updated = await res.json();
      setPasta((current) => current ? { ...current, status: updated.status } : current);
    } catch {
      setPasta(previous);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function duplicarPasta() {
    setDuplicating(true);
    setActionError("");
    try {
      const response = await fetch(`/api/pastas/${id}/duplicar`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao duplicar pasta");
      router.push(`/pasta/${data.pastaId}/editar`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Falha ao duplicar pasta");
      setDuplicating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{pasta.clienteNomeFantasia || "Pasta sem nome"}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${pastaStatus.color}`}>
              {pastaStatus.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {pasta.clienteRazaoSocial} · {pasta.clienteCnpj}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void atualizarStatus(pasta.status === "concluida" ? "rascunho" : "concluida"); }}
            disabled={updatingStatus}
            className={`border px-4 py-2 rounded-lg text-sm disabled:opacity-50 ${
              pasta.status === "concluida"
                ? "border-gray-300 text-gray-700 hover:bg-gray-50"
                : "border-green-200 text-green-700 hover:bg-green-50"
            }`}
          >
            {pasta.status === "concluida" ? "Reabrir pasta" : "Marcar concluida"}
          </button>
          <Link
            href={`/pasta/${id}/editar`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Editar dados
          </Link>
          <button
            onClick={() => { void duplicarPasta(); }}
            disabled={duplicating}
            className="border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50"
          >
            {duplicating ? "Duplicando..." : "Duplicar pasta"}
          </button>
          <Link
            href={`/pasta/${id}/processar`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            Gerar documentos
          </Link>
          {gerados > 0 && (
            <a
              href={`/api/pastas/${id}/download`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              Download ZIP ({gerados})
            </a>
          )}
        </div>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Localização</p>
          <p className="font-medium text-gray-900">{pasta.clienteCidade} / {pasta.clienteEstado}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Responsável Técnico</p>
          <p className="font-medium text-gray-900">{pasta.clienteRtNome || "—"}</p>
        </div>
      </div>

      <div className={`border rounded-xl p-5 mb-6 ${prontaParaEntrega ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-900">Conferência final</h2>
            <p className={`text-sm ${prontaParaEntrega ? "text-green-700" : "text-amber-700"}`}>
              {prontaParaEntrega ? "Pasta pronta para entrega." : "Revise os itens abaixo antes de entregar."}
            </p>
          </div>
          {gerados > 0 && (
            <a
              href={`/api/pastas/${id}/download`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              Baixar ZIP final
            </a>
          )}
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p className={pendentes ? "text-amber-800" : "text-green-700"}>{pendentes ? `${pendentes} pendente(s)` : "Sem pendências de geração"}</p>
          <p className={comErro ? "text-red-700" : "text-green-700"}>{comErro ? `${comErro} documento(s) com erro` : "Sem erros"}</p>
          <p className={semTemplate ? "text-red-700" : "text-green-700"}>{semTemplate ? `${semTemplate} sem template` : "Templates definidos"}</p>
          <p className={camposPendentes.length ? "text-amber-800" : "text-green-700"}>
            {camposPendentes.length ? `Dados faltantes: ${camposPendentes.join(", ")}` : "Dados essenciais preenchidos"}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Documentos</h2>
          <span className="text-sm text-gray-500">{gerados}/{total} gerados</span>
        </div>
        {pasta.documentos.length === 0 ? (
          <p className="px-5 py-6 text-gray-600 text-sm">Nenhum documento listado ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documentosOrdenados.map((doc) => {
              const st = STATUS_LABELS[doc.status] || STATUS_LABELS.pendente;
              const versoesAnteriores = doc.versoes.filter((versao) => versao.outputPath !== doc.outputPath);
              return (
                <li key={doc.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-800">{doc.nomeArquivo}</span>
                    <div className="flex items-center gap-3">
                      {doc.tokensUsados && (
                        <span className="text-xs text-gray-500">{doc.tokensUsados} tokens</span>
                      )}
                      <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                      {doc.outputPath && (
                        <>
                          <button
                            type="button"
                            onClick={() => { void visualizarDocumento(doc); }}
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Visualizar
                          </button>
                          <a
                            href={`/api/pastas/${id}/documentos/${doc.id}/download`}
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Baixar atual
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {doc.mensagemErro && (
                    <p className="text-xs text-red-500 mt-1" title={doc.mensagemErro}>{doc.mensagemErro}</p>
                  )}
                  {versoesAnteriores.length > 0 && (
                    <details className="mt-2 text-xs text-gray-600">
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
                              href={`/api/pastas/${id}/documentos/${doc.id}/download?versaoId=${versao.id}`}
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
        )}
      </div>
      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
