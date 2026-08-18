"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card, EmptyState, PageHeader } from "@/components/ui/Surface";
import { fieldClass } from "@/components/ui/Field";
import { describeErrorOrigin, Feedback, PASTA_STATUS, StatusBadge } from "@/components/ui/Status";
import { normalizeForMatch } from "@/components/ui/text";

interface Pasta {
  id: string;
  status: string;
  criadaEm: string;
  clienteNomeFantasia: string | null;
  clienteEstado: string | null;
  documentos: Array<{ id: string; status: string }>;
}

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "rascunho", label: "Rascunho" },
  { id: "processando", label: "Processando" },
  { id: "concluida", label: "Concluída" },
] as const;

type FiltroId = (typeof FILTROS)[number]["id"];

export default function Dashboard() {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroId>("todas");
  const [confirmDelete, setConfirmDelete] = useState<Pasta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    fetch("/api/pastas")
      .then((r) => {
        if (!r.ok) throw new Error(`O banco não respondeu a lista de pastas (HTTP ${r.status}).`);
        return r.json();
      })
      .then((data) => {
        setPastas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar as pastas do banco."
        );
        setLoading(false);
      });
  }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/pastas/${confirmDelete.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao excluir pasta");
      setPastas((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Falha ao excluir pasta");
    } finally {
      setDeleting(false);
    }
  }

  async function atualizarStatusPasta(pastaId: string, status: "rascunho" | "concluida") {
    const previous = pastas;
    setStatusError("");
    setPastas((prev) => prev.map((p) => (p.id === pastaId ? { ...p, status } : p)));
    try {
      const res = await fetch(`/api/pastas/${pastaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`O banco recusou a mudança de status (HTTP ${res.status}).`);
    } catch (error) {
      setPastas(previous);
      setStatusError(
        error instanceof Error ? error.message : "Não foi possível gravar o status no banco."
      );
    }
  }

  const contagens = useMemo(() => {
    const base: Record<string, number> = { todas: pastas.length };
    for (const item of FILTROS) {
      if (item.id === "todas") continue;
      base[item.id] = pastas.filter((p) => p.status === item.id).length;
    }
    return base;
  }, [pastas]);

  // Recentes primeiro: a pasta mexida por último é quase sempre a próxima a abrir.
  const visiveis = useMemo(() => {
    const termo = normalizeForMatch(busca.trim());
    return pastas
      .filter((pasta) => (filtro === "todas" ? true : pasta.status === filtro))
      .filter((pasta) => {
        if (!termo) return true;
        return normalizeForMatch(
          `${pasta.clienteNomeFantasia || ""} ${pasta.clienteEstado || ""}`
        ).includes(termo);
      })
      .sort((a, b) => new Date(b.criadaEm).getTime() - new Date(a.criadaEm).getTime());
  }, [pastas, busca, filtro]);

  const filtrando = filtro !== "todas" || busca.trim().length > 0;

  return (
    <div>
      <PageHeader
        title="Pastas Sanitárias"
        description="Cada pasta reúne os documentos de um cliente, do formulário à entrega."
        actions={
          <Link href="/pasta/nova" className={buttonClass("primary")}>
            Nova pasta
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          {FILTROS.map((item) => {
            const ativo = filtro === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                aria-label={`${item.label}: ${contagens[item.id] ?? 0} pasta(s)`}
                onClick={() => setFiltro(item.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                  ativo
                    ? "border-brand-action bg-brand-action text-brand-on-dark"
                    : "border-gray-300 bg-surface-card text-ink-muted hover:bg-surface-subtle"
                }`}
              >
                {item.label}
                <span className="tabular-nums">{contagens[item.id] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="lg:w-80">
          <label htmlFor="busca-pastas" className="sr-only">
            Buscar pasta por cliente ou UF
          </label>
          <input
            id="busca-pastas"
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por cliente ou UF..."
            className={fieldClass}
          />
        </div>
      </div>

      <div aria-live="polite">
        {statusError && (
          <Feedback tone="erro" title={describeErrorOrigin(statusError).rotulo} className="mb-4">
            {statusError}
          </Feedback>
        )}
      </div>

      {loading && <p className="text-sm text-ink-muted">Carregando pastas...</p>}

      {!loading && loadError && (
        <Feedback tone="erro" title={describeErrorOrigin(loadError).rotulo} live>
          {loadError} Atualize a página para tentar novamente.
        </Feedback>
      )}

      {!loading && !loadError && pastas.length === 0 && (
        <EmptyState
          title="Nenhuma pasta criada ainda"
          description="Comece enviando o PDF do formulário e o documento de elaboração do cliente."
          action={
            <Link href="/pasta/nova" className={buttonClass("primary")}>
              Criar primeira pasta
            </Link>
          }
        />
      )}

      {!loading && !loadError && pastas.length > 0 && (
        <>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base text-ink">
              {filtrando ? "Resultados" : "Recentes"}
            </h2>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {visiveis.length} de {pastas.length} pastas
            </p>
          </div>

          {visiveis.length === 0 ? (
            <EmptyState
              title="Nenhuma pasta encontrada"
              description="Ajuste a busca ou volte para todas as pastas."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBusca("");
                    setFiltro("todas");
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {visiveis.map((pasta) => {
                const status = PASTA_STATUS[pasta.status] || PASTA_STATUS.rascunho;
                const docsGerados = pasta.documentos.filter((d) => d.status === "gerado").length;
                const docsTotal = pasta.documentos.length;
                const nome = pasta.clienteNomeFantasia || "Pasta sem nome";
                const concluida = pasta.status === "concluida";
                return (
                  <li key={pasta.id}>
                    <Card className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                      <Link
                        href={`/pasta/${pasta.id}`}
                        className="min-w-[14rem] flex-1 rounded-md py-1"
                      >
                        <span className="block font-semibold text-ink">{nome}</span>
                        <span className="mt-0.5 block text-sm text-ink-muted">
                          {pasta.clienteEstado ? `${pasta.clienteEstado} · ` : ""}
                          Criada em {new Date(pasta.criadaEm).toLocaleDateString("pt-BR")}
                          {docsTotal > 0 ? ` · ${docsGerados}/${docsTotal} documentos gerados` : ""}
                        </span>
                      </Link>

                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          aria-label={`${concluida ? "Reabrir" : "Concluir"} pasta ${nome}`}
                          onClick={() => {
                            void atualizarStatusPasta(pasta.id, concluida ? "rascunho" : "concluida");
                          }}
                        >
                          {concluida ? "Reabrir" : "Concluir"}
                        </Button>
                        <Button
                          variant="danger"
                          aria-label={`Excluir pasta ${nome}`}
                          onClick={() => {
                            setDeleteError("");
                            setConfirmDelete(pasta);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Excluir pasta?"
          destrutiva
          busy={deleting}
          error={deleteError}
          confirmLabel={deleting ? "Excluindo..." : "Excluir pasta"}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            void handleDelete();
          }}
          description={
            <>
              <span className="font-semibold text-ink">
                {confirmDelete.clienteNomeFantasia || "Pasta sem nome"}
              </span>
              <br />
              Todos os documentos gerados desta pasta serão excluídos permanentemente. Esta ação não
              pode ser desfeita.
            </>
          }
        />
      )}
    </div>
  );
}
