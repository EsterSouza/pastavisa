"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PASTA_STATUS, StatusBadge, statusInfo } from "@/components/ui/Status";

const ABAS = [
  { sufixo: "", label: "Resumo" },
  { sufixo: "/editar", label: "Dados da cliente" },
  { sufixo: "/processar", label: "Gerar documentos" },
  { sufixo: "/varredura", label: "Varredura" },
  { sufixo: "/corrigir-lote", label: "Corrigir em lote" },
];

export interface PastaCabecalho {
  nome: string | null;
  status: string;
  /** "Cidade / UF", vazio se a pasta ainda não tem endereço. */
  local: string;
}

/**
 * Lê só o que o cabeçalho precisa, para as telas que não carregam a pasta
 * inteira. Falha de leitura deixa o cabeçalho com "Pasta sem nome": a tela
 * em si tem suas próprias mensagens de erro.
 */
export function usePastaCabecalho(id: string): PastaCabecalho | null {
  const [cabecalho, setCabecalho] = useState<PastaCabecalho | null>(null);
  useEffect(() => {
    let ativo = true;
    fetch(`/api/pastas/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((pasta) => {
        if (!ativo) return;
        setCabecalho({
          nome: pasta?.clienteNomeFantasia ?? null,
          status: pasta?.status || "rascunho",
          local: [pasta?.clienteCidade, pasta?.clienteEstado].filter(Boolean).join(" / "),
        });
      })
      .catch(() => {
        if (ativo) setCabecalho({ nome: null, status: "rascunho", local: "" });
      });
    return () => {
      ativo = false;
    };
  }, [id]);
  return cabecalho;
}

/**
 * Cabeçalho comum às telas de uma pasta: trilha, nome da cliente, situação e
 * abas. Antes cada tela tinha só "Voltar para a pasta" e nenhuma dizia de qual
 * cliente era.
 */
export function PastaHeader({
  id,
  nome,
  status,
  meta,
  actions,
}: {
  id: string;
  /** undefined enquanto a pasta carrega; null quando ela não tem nome fantasia. */
  nome: string | null | undefined;
  status?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/pasta/${id}`;
  const situacao = status ? statusInfo(PASTA_STATUS, status, PASTA_STATUS.rascunho) : null;
  const titulo = nome === undefined ? "Carregando..." : nome || "Pasta sem nome";

  return (
    <header className="mb-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="rounded hover:text-ink hover:underline">
          Pastas
        </Link>
        <span aria-hidden="true">›</span>
        <span className="truncate text-ink">{titulo}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`font-display text-2xl ${nome === undefined ? "text-ink-subtle" : "text-ink"}`}>{titulo}</h1>
            {situacao && <StatusBadge tone={situacao.tone}>{situacao.label}</StatusBadge>}
          </div>
          {meta && <p className="mt-1 text-sm text-ink-muted">{meta}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <nav aria-label="Seções da pasta" className="mt-4 flex gap-6 border-b border-gray-200">
        {ABAS.map((aba) => {
          const href = `${base}${aba.sufixo}`;
          const ativa = pathname === href;
          return (
            <Link
              key={aba.label}
              href={href}
              aria-current={ativa ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 shrink-0 items-center border-b-[3px] px-1 text-sm font-semibold ${
                ativa
                  ? "border-brand-action text-ink"
                  : "border-transparent text-ink-muted hover:border-gray-300 hover:text-ink"
              }`}
            >
              {aba.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
