"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PASTA_STATUS, StatusBadge, statusInfo } from "@/components/ui/Status";

const ABAS = [
  { sufixo: "", label: "Resumo" },
  { sufixo: "/editar", label: "Dados da cliente" },
  { sufixo: "/processar", label: "Gerar documentos" },
  { sufixo: "/varredura", label: "Varredura" },
  { sufixo: "/corrigir-lote", label: "Corrigir em lote" },
];

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
  nome: string | null;
  status?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/pasta/${id}`;
  const situacao = status ? statusInfo(PASTA_STATUS, status, PASTA_STATUS.rascunho) : null;

  return (
    <header className="mb-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="rounded hover:text-ink hover:underline">
          Pastas
        </Link>
        <span aria-hidden="true">›</span>
        <span className="truncate text-ink">{nome || "Carregando..."}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl text-ink">{nome || "Pasta sem nome"}</h1>
            {situacao && <StatusBadge tone={situacao.tone}>{situacao.label}</StatusBadge>}
          </div>
          {meta && <p className="mt-1 text-sm text-ink-muted">{meta}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <nav aria-label="Seções da pasta" className="mt-4 flex gap-6 overflow-x-auto border-b border-gray-200">
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
