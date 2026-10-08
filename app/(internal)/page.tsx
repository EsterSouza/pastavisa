"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, PageHeader } from "@/components/ui/Surface";
import { fieldClass } from "@/components/ui/Field";
import { describeErrorOrigin, Feedback, StatusBadge, type Tone } from "@/components/ui/Status";
import { normalizeForMatch } from "@/components/ui/text";

// Mesmo prazo de app/api/cron/retencao-pastas: concluída, a pasta some em 30 dias.
const DIAS_RETENCAO = 30;

interface Pasta {
  id: string;
  status: string;
  criadaEm: string;
  concluidaEm: string | null;
  clienteNomeFantasia: string | null;
  clienteRazaoSocial: string | null;
  clienteCnpj: string | null;
  clienteCidade: string | null;
  clienteEstado: string | null;
  documentos: Array<{ id: string; status: string }>;
}

// Situação de trabalho, derivada dos documentos: diz o que a pasta pede agora,
// não só o status gravado no banco.
type Situacao = "producao" | "erro" | "pronta" | "concluida";

const FILTROS: Array<{ id: "todas" | Situacao; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "producao", label: "Em produção" },
  { id: "erro", label: "Com erro" },
  { id: "pronta", label: "Prontas" },
  { id: "concluida", label: "Concluídas" },
];

type FiltroId = (typeof FILTROS)[number]["id"];

function dataCurta(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function exclusaoEm(pasta: Pasta): Date | null {
  if (pasta.status !== "concluida" || !pasta.concluidaEm) return null;
  return new Date(new Date(pasta.concluidaEm).getTime() + DIAS_RETENCAO * 24 * 60 * 60 * 1000);
}

function situacaoDa(pasta: Pasta): { id: Situacao; label: string; tone: Tone } {
  if (pasta.status === "concluida") {
    const exclui = exclusaoEm(pasta);
    return { id: "concluida", label: exclui ? `Concluída · exclui em ${dataCurta(exclui).slice(0, 5)}` : "Concluída", tone: "neutro" };
  }
  const total = pasta.documentos.length;
  const gerados = pasta.documentos.filter((d) => d.status === "gerado").length;
  if (pasta.documentos.some((d) => d.status === "erro")) return { id: "erro", label: "Com erro", tone: "atencao" };
  if (total > 0 && gerados === total) return { id: "pronta", label: "Pronta", tone: "sucesso" };
  if (gerados === 0) return { id: "producao", label: total === 0 ? "Sem documentos" : "Rascunho", tone: "neutro" };
  return { id: "producao", label: "Em produção", tone: "info" };
}

export default function Dashboard() {
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroId>("todas");
  const [confirmDelete, setConfirmDelete] = useState<Pasta | null>(null);
  const [confirmConcluir, setConfirmConcluir] = useState<Pasta | null>(null);
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
      const updated = await res.json();
      setPastas((prev) =>
        prev.map((p) => (p.id === pastaId ? { ...p, status: updated.status, concluidaEm: updated.concluidaEm ?? null } : p))
      );
    } catch (error) {
      setPastas(previous);
      setStatusError(
        error instanceof Error ? error.message : "Não foi possível gravar o status no banco."
      );
    }
  }

  const comSituacao = useMemo(() => pastas.map((pasta) => ({ pasta, situacao: situacaoDa(pasta) })), [pastas]);

  const contagens = useMemo(() => {
    const base: Record<FiltroId, number> = { todas: pastas.length, producao: 0, erro: 0, pronta: 0, concluida: 0 };
    comSituacao.forEach(({ situacao }) => {
      base[situacao.id] += 1;
    });
    return base;
  }, [comSituacao, pastas.length]);

  // Recentes primeiro: a pasta mexida por último é quase sempre a próxima a abrir.
  const visiveis = useMemo(() => {
    const termo = normalizeForMatch(busca.trim());
    return comSituacao
      .filter(({ situacao }) => (filtro === "todas" ? true : situacao.id === filtro))
      .filter(({ pasta }) => {
        if (!termo) return true;
        return normalizeForMatch(
          [
            pasta.clienteNomeFantasia,
            pasta.clienteRazaoSocial,
            pasta.clienteCidade,
            pasta.clienteEstado,
            pasta.clienteCnpj,
            pasta.clienteCnpj?.replace(/\D/g, ""),
          ].filter(Boolean).join(" ")
        ).includes(termo);
      })
      .sort((a, b) => new Date(b.pasta.criadaEm).getTime() - new Date(a.pasta.criadaEm).getTime());
  }, [comSituacao, busca, filtro]);

  const filtrando = filtro !== "todas" || busca.trim().length > 0;

  const resumo: Array<{ id: Situacao; rotulo: string; cor: string }> = [
    { id: "producao", rotulo: "Em produção", cor: "text-ink" },
    { id: "erro", rotulo: "Com erro na geração", cor: contagens.erro > 0 ? "text-status-warning" : "text-ink" },
    { id: "pronta", rotulo: "Prontas para entregar", cor: contagens.pronta > 0 ? "text-status-success" : "text-ink" },
    { id: "concluida", rotulo: `Concluídas · somem em ${DIAS_RETENCAO} dias`, cor: "text-ink" },
  ];

  return (
    <div className="mx-auto max-w-[80rem]">
      <PageHeader
        title="Pastas sanitárias"
        description="Uma pasta por cliente. Abra para gerar, conferir e entregar."
        actions={
          <Link href="/pasta/nova" className={buttonClass("primary")}>
            + Nova pasta
          </Link>
        }
      />

      {!loading && !loadError && pastas.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {resumo.map((item) => {
            const ativo = filtro === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFiltro(ativo ? "todas" : item.id)}
                className={`flex flex-col gap-1 rounded-lg border bg-surface-card px-4 py-3 text-left hover:bg-surface-subtle ${
                  ativo ? "border-brand-action ring-1 ring-brand-action" : "border-gray-200"
                }`}
              >
                <span className="text-sm text-ink-muted">{item.rotulo}</span>
                <span className={`font-display text-2xl ${item.cor}`}>{contagens[item.id]}</span>
              </button>
            );
          })}
        </div>
      )}

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
        <section aria-label="Lista de pastas" className="rounded-lg border border-gray-200 bg-surface-card">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-[16rem] flex-[1_1_20rem]">
              <label htmlFor="busca-pastas" className="sr-only">
                Buscar pasta por cliente, cidade ou CNPJ
              </label>
              <input
                id="busca-pastas"
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar cliente, cidade ou CNPJ"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
              {FILTROS.map((item) => {
                const ativo = filtro === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(item.id)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
                      ativo
                        ? "border-brand-action bg-brand-action text-brand-on-dark"
                        : "border-gray-300 bg-surface-card text-ink-muted hover:bg-surface-subtle hover:text-ink"
                    }`}
                  >
                    {item.label}
                    <span className={`tabular-nums ${ativo ? "" : "text-ink-subtle"}`}>{contagens[item.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1.6fr)_12rem_minmax(9rem,1fr)_7rem_2.75rem] items-center gap-4 border-y border-gray-200 bg-surface-subtle px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <span aria-live="polite">
              Cliente · {visiveis.length} de {pastas.length}
            </span>
            <span>Situação</span>
            <span>Progresso</span>
            <span>Criada em</span>
            <span className="sr-only">Ações</span>
          </div>

          {visiveis.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="font-display text-base text-ink">Nenhuma pasta encontrada</p>
              <p className="mt-1 text-sm text-ink-muted">Ajuste a busca ou volte para todas as pastas.</p>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  setBusca("");
                  setFiltro("todas");
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {visiveis.map(({ pasta, situacao }) => {
                const docsGerados = pasta.documentos.filter((d) => d.status === "gerado").length;
                const docsTotal = pasta.documentos.length;
                const pct = docsTotal > 0 ? Math.round((docsGerados / docsTotal) * 100) : 0;
                const nome = pasta.clienteNomeFantasia || "Pasta sem nome";
                const concluida = pasta.status === "concluida";
                const local = [pasta.clienteCidade, pasta.clienteEstado].filter(Boolean).join(" / ");
                return (
                  <li
                    key={pasta.id}
                    className="relative grid grid-cols-[minmax(0,1.6fr)_12rem_minmax(9rem,1fr)_7rem_2.75rem] items-center gap-4 px-4 py-3 hover:bg-surface-subtle"
                  >
                    {/* O link cobre a linha inteira; o menu ⋯ fica por cima dele. */}
                    <div className="min-w-0">
                      <Link
                        href={`/pasta/${pasta.id}`}
                        className="block truncate font-semibold text-ink after:absolute after:inset-0 after:content-['']"
                      >
                        {nome}
                      </Link>
                      <p className="truncate text-sm text-ink-muted">{local || "Sem cidade/UF"}</p>
                    </div>
                    <div>
                      <StatusBadge tone={situacao.tone}>{situacao.label}</StatusBadge>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm text-ink-muted">
                        {docsTotal > 0 ? `${docsGerados} de ${docsTotal} gerados` : "Sem documentos"}
                      </span>
                      <span
                        className="block h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                        role="img"
                        aria-label={`${pct}% gerado`}
                      >
                        <span
                          className={`block h-full ${situacao.id === "erro" ? "bg-status-warning" : "bg-brand-action"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </div>
                    <span className="text-sm text-ink-muted">{dataCurta(pasta.criadaEm)}</span>
                    <div className="relative z-[1]">
                      <ActionMenu
                        label={`Mais ações de ${nome}`}
                        items={[
                          concluida
                            ? { label: "Reabrir pasta", onSelect: () => { void atualizarStatusPasta(pasta.id, "rascunho"); } }
                            : { label: "Marcar como concluída…", onSelect: () => setConfirmConcluir(pasta) },
                          {
                            label: "Excluir pasta…",
                            destrutiva: true,
                            onSelect: () => {
                              setDeleteError("");
                              setConfirmDelete(pasta);
                            },
                          },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {filtrando && visiveis.length > 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          Mostrando {visiveis.length} de {pastas.length} pastas.{" "}
          <button
            type="button"
            className="font-semibold text-brand-accent underline-offset-4 hover:underline"
            onClick={() => {
              setBusca("");
              setFiltro("todas");
            }}
          >
            Ver todas
          </button>
        </p>
      )}

      {confirmConcluir && (
        <ConfirmDialog
          title="Marcar a pasta como concluída?"
          confirmLabel="Sim, concluir"
          description={
            <>
              <span className="font-semibold text-ink">
                {confirmConcluir.clienteNomeFantasia || "Pasta sem nome"}
              </span>
              <br />
              Concluída, a pasta e os arquivos gerados são excluídos automaticamente{" "}
              <strong>{DIAS_RETENCAO} dias depois</strong>. Baixe o ZIP final antes. Até lá, dá para reabrir.
            </>
          }
          onCancel={() => setConfirmConcluir(null)}
          onConfirm={() => {
            const alvo = confirmConcluir;
            setConfirmConcluir(null);
            void atualizarStatusPasta(alvo.id, "concluida");
          }}
        />
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
