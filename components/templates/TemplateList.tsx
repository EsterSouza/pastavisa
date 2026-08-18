"use client";

import { fieldClass } from "@/components/ui/Field";
import { normalizeForMatch } from "@/components/ui/text";
import { PROCESSING_TYPES, TIPOS, type Template } from "@/components/templates/constants";
import { TemplateListItem } from "@/components/templates/TemplateListItem";

interface TemplateListProps {
  templates: Template[];
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroTipo: string;
  onFiltroTipoChange: (value: string) => void;
  filtroPT: string;
  onFiltroPTChange: (value: string) => void;
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onSelectNone: () => void;
  onBulkToggleAtivo: (ativar: boolean) => void;
  onBulkDelete: () => void;
  bulkDeleting: boolean;
  onUpdateProcessingType: (id: string, processingType: string) => void;
  onVisualizar: (t: Template) => void;
  onValidar: (t: Template) => void;
  onVerVersoes: (t: Template) => void;
  onEditar: (t: Template) => void;
  onDuplicar: (id: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (t: Template) => void;
  loadingPreview: string | null;
  loadingVars: string | null;
  loadingVersions: string | null;
  duplicando: string | null;
}

export function filtrarTemplates(templates: Template[], busca: string, filtroTipo: string, filtroPT: string): Template[] {
  const q = normalizeForMatch(busca);
  return templates.filter((t) => {
    const matchBusca = !q || normalizeForMatch(t.nome).includes(q) || normalizeForMatch(t.tipo).includes(q);
    const matchTipo = !filtroTipo || t.tipo === filtroTipo;
    const matchPT = !filtroPT || t.processingType === filtroPT;
    return matchBusca && matchTipo && matchPT;
  });
}

export function TemplateList({
  templates,
  busca,
  onBuscaChange,
  filtroTipo,
  onFiltroTipoChange,
  filtroPT,
  onFiltroPTChange,
  selected,
  onToggleOne,
  onSelectAll,
  onSelectNone,
  onBulkToggleAtivo,
  onBulkDelete,
  bulkDeleting,
  onUpdateProcessingType,
  onVisualizar,
  onValidar,
  onVerVersoes,
  onEditar,
  onDuplicar,
  onToggleAtivo,
  onExcluir,
  loadingPreview,
  loadingVars,
  loadingVersions,
  duplicando,
}: TemplateListProps) {
  const templatesFiltrados = filtrarTemplates(templates, busca, filtroTipo, filtroPT);

  return (
    <div className="rounded-lg border border-gray-200 bg-surface-card">
      {selected.size === 0 ? (
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base text-ink">
              Templates cadastrados{" "}
              <span className="font-normal text-ink-muted">
                ({templatesFiltrados.length}
                {templatesFiltrados.length !== templates.length ? ` de ${templates.length}` : ""})
              </span>
            </h2>
            {templates.length > 0 && (
              <button onClick={() => onSelectAll(templatesFiltrados.map((t) => t.id))} className="text-xs text-brand-accent hover:underline">
                Selecionar todos
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              placeholder="Buscar template..."
              aria-label="Buscar template"
              className={`min-w-48 flex-1 ${fieldClass}`}
            />
            <select value={filtroTipo} onChange={(e) => onFiltroTipoChange(e.target.value)} className={fieldClass} aria-label="Filtrar por tipo">
              <option value="">Todos os tipos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={filtroPT} onChange={(e) => onFiltroPTChange(e.target.value)} className={fieldClass} aria-label="Filtrar por processamento">
              <option value="">Todos os processamentos</option>
              {PROCESSING_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {(busca || filtroTipo || filtroPT) && (
              <button
                onClick={() => {
                  onBuscaChange("");
                  onFiltroTipoChange("");
                  onFiltroPTChange("");
                }}
                className="px-2 py-1.5 text-xs text-ink-subtle hover:text-ink"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-surface-subtle px-5 py-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.size === templates.length}
              onChange={(e) => (e.target.checked ? onSelectAll(templates.map((t) => t.id)) : onSelectNone())}
              aria-label="Selecionar todos os templates"
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-action"
            />
            <span className="text-sm font-medium text-ink">
              {selected.size} selecionado{selected.size > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onBulkToggleAtivo(true)}
              className="rounded-lg border border-status-success bg-surface-card px-3 py-1.5 text-xs font-medium text-status-success hover:bg-status-success-soft"
            >
              Ativar todos
            </button>
            <button
              onClick={() => onBulkToggleAtivo(false)}
              className="rounded-lg border border-gray-300 bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-subtle"
            >
              Desativar todos
            </button>
            <button
              onClick={onBulkDelete}
              disabled={bulkDeleting}
              className="rounded-lg border border-status-danger bg-surface-card px-3 py-1.5 text-xs font-medium text-status-danger hover:bg-status-danger-soft disabled:opacity-50"
            >
              {bulkDeleting ? "Excluindo..." : `Excluir ${selected.size}`}
            </button>
            <button onClick={onSelectNone} className="px-2 text-xs text-ink-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && (
        <p className="px-5 py-6 text-sm text-ink-muted">
          Nenhum template cadastrado. Use a importação em lote acima para começar.
        </p>
      )}

      {templates.length > 0 && templatesFiltrados.length === 0 && (
        <p className="px-5 py-6 text-center text-sm text-ink-muted">Nenhum template encontrado com os filtros aplicados.</p>
      )}

      <ul className="divide-y divide-gray-100">
        {templatesFiltrados.map((t) => (
          <TemplateListItem
            key={t.id}
            template={t}
            selected={selected.has(t.id)}
            onToggleSelect={onToggleOne}
            onUpdateProcessingType={onUpdateProcessingType}
            onVisualizar={onVisualizar}
            onValidar={onValidar}
            onVerVersoes={onVerVersoes}
            onEditar={onEditar}
            onDuplicar={onDuplicar}
            onToggleAtivo={onToggleAtivo}
            onExcluir={onExcluir}
            loadingPreview={loadingPreview === t.id}
            loadingVars={loadingVars === t.id}
            loadingVersions={loadingVersions === t.id}
            duplicando={duplicando === t.id}
          />
        ))}
      </ul>
    </div>
  );
}
