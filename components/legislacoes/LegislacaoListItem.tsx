"use client";

import type { Tone } from "@/components/ui/Status";
import { ESFERA_TONE, TIPOS_FORM, esferaDe, segmentoDe, type Legislacao } from "@/components/legislacoes/constants";

const TONE_BADGE_CLASS: Record<Tone, string> = {
  neutro: "bg-gray-100 text-ink-muted",
  info: "bg-blue-100 text-brand-navy",
  sucesso: "bg-green-100 text-status-success",
  atencao: "bg-amber-100 text-status-warning",
  erro: "bg-red-100 text-status-danger",
};

interface LegislacaoListItemProps {
  leg: Legislacao;
  onEditar: (leg: Legislacao) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (leg: Legislacao) => void;
  deletando: boolean;
}

export function LegislacaoListItem({ leg, onEditar, onToggleAtivo, onExcluir, deletando }: LegislacaoListItemProps) {
  const tone = ESFERA_TONE[esferaDe(leg.tipo)];

  return (
    <li className={`px-5 py-4 ${!leg.ativo ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col gap-1 pt-0.5">
          <span className={`rounded px-2 py-0.5 text-center text-xs font-medium ${TONE_BADGE_CLASS[tone]}`}>{leg.estadoUf}</span>
          {leg.municipio && <span className="rounded bg-gray-100 px-2 py-0.5 text-center text-xs text-ink-muted">{leg.municipio}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-ink">{leg.titulo}</p>
          <p className="mt-0.5 line-clamp-2 break-words text-xs text-ink-muted">{leg.referenciaAbnt}</p>
          <p className="mt-1 text-xs text-ink-subtle">
            {TIPOS_FORM.find((t) => t.value === leg.tipo)?.label || leg.tipo} · {segmentoDe(leg.titulo, leg.referenciaAbnt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => onEditar(leg)} className="rounded border border-gray-300 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-subtle">
            Editar
          </button>
          <button
            onClick={() => onToggleAtivo(leg.id, leg.ativo)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              leg.ativo
                ? "border-status-success bg-status-success-soft text-status-success hover:opacity-90"
                : "border-gray-300 text-ink-muted hover:bg-surface-subtle"
            }`}
          >
            {leg.ativo ? "Ativa" : "Inativa"}
          </button>
          <button
            onClick={() => onExcluir(leg)}
            disabled={deletando}
            className="rounded border border-status-danger px-2.5 py-1 text-xs text-status-danger hover:bg-status-danger-soft disabled:opacity-50"
          >
            {deletando ? "..." : "Excluir"}
          </button>
        </div>
      </div>
    </li>
  );
}
