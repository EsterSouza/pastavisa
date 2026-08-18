"use client";

import { fieldClass } from "@/components/ui/Field";
import { normalizeForMatch } from "@/components/ui/text";
import { ESTADOS_BR, esferaDe, segmentoDe, type Legislacao } from "@/components/legislacoes/constants";
import { LegislacaoListItem } from "@/components/legislacoes/LegislacaoListItem";

const SEGMENTOS = ["Transversal", "Estética", "Enfermagem", "Resíduos", "ILPI"];

export function filtrarLegislacoes(
  items: Legislacao[],
  busca: string,
  filtroEstado: string,
  filtroEsfera: string,
  filtroSegmento: string
): Legislacao[] {
  const q = normalizeForMatch(busca);
  return items.filter((leg) => {
    if (filtroEstado && leg.estadoUf !== filtroEstado) return false;
    if (filtroEsfera && esferaDe(leg.tipo) !== filtroEsfera) return false;
    if (filtroSegmento && segmentoDe(leg.titulo, leg.referenciaAbnt) !== filtroSegmento) return false;
    if (q && !normalizeForMatch(leg.titulo).includes(q) && !normalizeForMatch(leg.referenciaAbnt).includes(q)) return false;
    return true;
  });
}

interface LegislacaoListProps {
  items: Legislacao[];
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroEstado: string;
  onFiltroEstadoChange: (value: string) => void;
  filtroEsfera: string;
  onFiltroEsferaChange: (value: string) => void;
  filtroSegmento: string;
  onFiltroSegmentoChange: (value: string) => void;
  onEditar: (leg: Legislacao) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (leg: Legislacao) => void;
  deletandoId: string | null;
}

export function LegislacaoList({
  items,
  busca,
  onBuscaChange,
  filtroEstado,
  onFiltroEstadoChange,
  filtroEsfera,
  onFiltroEsferaChange,
  filtroSegmento,
  onFiltroSegmentoChange,
  onEditar,
  onToggleAtivo,
  onExcluir,
  deletandoId,
}: LegislacaoListProps) {
  const filtrados = filtrarLegislacoes(items, busca, filtroEstado, filtroEsfera, filtroSegmento);

  return (
    <div className="rounded-lg border border-gray-200 bg-surface-card">
      <div className="space-y-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base text-ink">
            Legislações cadastradas{" "}
            <span className="font-normal text-ink-muted">
              ({filtrados.length} de {items.length})
            </span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar por título ou referência..."
            aria-label="Buscar por título ou referência"
            className={`min-w-48 flex-1 ${fieldClass}`}
          />
          <select value={filtroEstado} onChange={(e) => onFiltroEstadoChange(e.target.value)} className={fieldClass} aria-label="Filtrar por estado">
            <option value="">Todos os estados</option>
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf}>
                {uf === "BR" ? "Federal (BR)" : uf}
              </option>
            ))}
          </select>
          <select value={filtroEsfera} onChange={(e) => onFiltroEsferaChange(e.target.value)} className={fieldClass} aria-label="Filtrar por esfera">
            <option value="">Todas as esferas</option>
            <option value="federal">Federal</option>
            <option value="estadual">Estadual</option>
            <option value="municipal">Municipal</option>
          </select>
          <select value={filtroSegmento} onChange={(e) => onFiltroSegmentoChange(e.target.value)} className={fieldClass} aria-label="Filtrar por segmento">
            <option value="">Todos os segmentos</option>
            {SEGMENTOS.map((segmento) => (
              <option key={segmento} value={segmento}>
                {segmento}
              </option>
            ))}
          </select>
          {(busca || filtroEstado || filtroEsfera || filtroSegmento) && (
            <button
              onClick={() => {
                onBuscaChange("");
                onFiltroEstadoChange("");
                onFiltroEsferaChange("");
                onFiltroSegmentoChange("");
              }}
              className="rounded border border-gray-200 px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-subtle hover:text-ink"
            >
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {filtrados.length === 0 && <p className="px-5 py-6 text-sm text-ink-muted">Nenhuma legislação encontrada.</p>}

      <ul className="divide-y divide-gray-100">
        {filtrados.map((leg) => (
          <LegislacaoListItem
            key={leg.id}
            leg={leg}
            onEditar={onEditar}
            onToggleAtivo={onToggleAtivo}
            onExcluir={onExcluir}
            deletando={deletandoId === leg.id}
          />
        ))}
      </ul>
    </div>
  );
}
