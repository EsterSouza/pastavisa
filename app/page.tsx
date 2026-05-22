"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Pasta {
  id: string;
  status: string;
  criadaEm: string;
  clienteNomeFantasia: string | null;
  clienteEstado: string | null;
  documentos: Array<{ id: string; status: string }>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-600" },
  processando: { label: "Processando", color: "bg-yellow-100 text-yellow-700" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700" },
};

export default function Dashboard() {
  const router = useRouter();
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Pasta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [criandoTeste, setCriandoTeste] = useState(false);

  useEffect(() => {
    fetch("/api/pastas")
      .then((r) => r.json())
      .then((data) => {
        setPastas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    await fetch(`/api/pastas/${confirmDelete.id}`, { method: "DELETE" });
    setPastas((prev) => prev.filter((p) => p.id !== confirmDelete.id));
    setConfirmDelete(null);
    setDeleting(false);
  }

  async function handleCriarTeste() {
    setCriandoTeste(true);
    try {
      const res = await fetch("/api/pastas/teste", { method: "POST" });
      const json = await res.json();
      router.push(`/pasta/${json.pastaId}/editar`);
    } catch {
      setCriandoTeste(false);
    }
  }

  async function atualizarStatusPasta(pastaId: string, status: "rascunho" | "concluida") {
    const previous = pastas;
    setPastas((prev) => prev.map((p) => p.id === pastaId ? { ...p, status } : p));
    try {
      const res = await fetch(`/api/pastas/${pastaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
    } catch {
      setPastas(previous);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pastas Sanitárias</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { void handleCriarTeste(); }}
            disabled={criandoTeste}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {criandoTeste ? "Criando…" : "🧪 Pasta de teste"}
          </button>
          <Link
            href="/pasta/nova"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Nova Pasta
          </Link>
        </div>
      </div>

      {loading && <p className="text-gray-500">Carregando...</p>}

      {!loading && pastas.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 mb-4">Nenhuma pasta criada ainda.</p>
          <Link href="/pasta/nova" className="text-blue-600 hover:underline text-sm">
            Criar primeira pasta →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {pastas.map((pasta) => {
          const st = STATUS_LABELS[pasta.status] || STATUS_LABELS.rascunho;
          const docsGerados = pasta.documentos.filter((d) => d.status === "gerado").length;
          const docsTotal = pasta.documentos.length;
          return (
            <div
              key={pasta.id}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <Link
                href={`/pasta/${pasta.id}`}
                className="flex-1 px-5 py-4 min-w-0"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {pasta.clienteNomeFantasia || <span className="text-gray-400 italic">Sem nome</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {pasta.clienteEstado && <span className="mr-2">{pasta.clienteEstado}</span>}
                      {new Date(pasta.criadaEm).toLocaleDateString("pt-BR")}
                      {docsTotal > 0 && (
                        <span className="ml-2">
                          · {docsGerados}/{docsTotal} documentos
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`ml-4 shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>
                    {st.label}
                  </span>
                </div>
              </Link>

              <button
                onClick={() => {
                  void atualizarStatusPasta(
                    pasta.id,
                    pasta.status === "concluida" ? "rascunho" : "concluida"
                  );
                }}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  pasta.status === "concluida"
                    ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                    : "border-green-200 text-green-700 hover:bg-green-50"
                }`}
                title={pasta.status === "concluida" ? "Reabrir pasta" : "Marcar como concluida"}
              >
                {pasta.status === "concluida" ? "Reabrir" : "Concluir"}
              </button>

              <button
                onClick={() => setConfirmDelete(pasta)}
                className="mr-3 shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded"
                title="Excluir pasta"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Excluir pasta?</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{confirmDelete.clienteNomeFantasia || "Sem nome"}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Todos os documentos gerados desta pasta serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleDelete(); }}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
