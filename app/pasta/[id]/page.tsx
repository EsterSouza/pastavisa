"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetch(`/api/pastas/${id}`)
      .then((r) => r.json())
      .then(setPasta);
  }, [id]);

  if (!pasta) return <p className="text-gray-500">Carregando...</p>;

  const gerados = pasta.documentos.filter((d) => d.status === "gerado").length;
  const total = pasta.documentos.length;
  const pastaStatus = PASTA_STATUS_LABELS[pasta.status] || PASTA_STATUS_LABELS.rascunho;

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

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Documentos</h2>
          <span className="text-sm text-gray-500">{gerados}/{total} gerados</span>
        </div>
        {pasta.documentos.length === 0 ? (
          <p className="px-5 py-6 text-gray-600 text-sm">Nenhum documento listado ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pasta.documentos.map((doc) => {
              const st = STATUS_LABELS[doc.status] || STATUS_LABELS.pendente;
              return (
                <li key={doc.id} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-800">{doc.nomeArquivo}</span>
                  <div className="flex items-center gap-3">
                    {doc.tokensUsados && (
                      <span className="text-xs text-gray-500">{doc.tokensUsados} tokens</span>
                    )}
                    <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                    {doc.mensagemErro && (
                      <span className="text-xs text-red-500 max-w-xs truncate" title={doc.mensagemErro}>
                        {doc.mensagemErro}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
