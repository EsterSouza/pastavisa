"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { normalizeForMatch } from "@/components/ui/text";
import { PROCESSING_TYPES, type Template } from "@/components/templates/constants";
import { TEMPLATE_GRID, TemplateListItem } from "@/components/templates/TemplateListItem";

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

// A API devolve do mais novo para o mais antigo; na tela a ordem é sempre
// alfabética, sem diferenciar maiúscula nem acento.
export function filtrarTemplates(templates: Template[], busca: string, filtroTipo: string, filtroPT: string): Template[] {
  const q = normalizeForMatch(busca);
  return templates
    .filter((t) => {
      const matchBusca = !q || normalizeForMatch(t.nome).includes(q) || normalizeForMatch(t.tipo).includes(q);
      const matchTipo = !filtroTipo || t.tipo === filtroTipo;
      const matchPT = !filtroPT || t.processingType === filtroPT;
      return matchBusca && matchTipo && matchPT;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
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
  const todosRef = useRef<HTMLInputElement>(null);

  // Chips só para os tipos que existem no acervo, do mais comum ao mais raro.
  const tipos = Object.entries(
    templates.reduce<Record<string, number>>((acc, t) => {
      acc[t.tipo] = (acc[t.tipo] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const visiveisSelecionados = templatesFiltrados.filter((t) => selected.has(t.id)).length;
  const todosSelecionados = templatesFiltrados.length > 0 && visiveisSelecionados === templatesFiltrados.length;
  useEffect(() => {
    if (todosRef.current) todosRef.current.indeterminate = visiveisSelecionados > 0 && !todosSelecionados;
  }, [visiveisSelecionados, todosSelecionados]);

  const chipClass = (ativo: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
      ativo
        ? "border-brand-action bg-brand-action text-brand-on-dark"
        : "border-gray-300 bg-surface-card text-ink-muted hover:bg-surface-subtle hover:text-ink"
    }`;

  return (
    <section aria-label="Templates cadastrados" className="rounded-lg border border-gray-200 bg-surface-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="min-w-[16rem] flex-[1_1_20rem]">
          <input
            type="search"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar por nome — ignora acento e maiúscula"
            aria-label="Buscar template"
            className={fieldClass}
          />
        </div>
        <div className="w-56">
          <select value={filtroPT} onChange={(e) => onFiltroPTChange(e.target.value)} className={fieldClass} aria-label="Filtrar por processamento">
            <option value="">Qualquer processamento</option>
            {PROCESSING_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {(busca || filtroTipo || filtroPT) && (
          <Button
            variant="quiet"
            onClick={() => {
              onBuscaChange("");
              onFiltroTipoChange("");
              onFiltroPTChange("");
            }}
          >
            Limpar filtros
          </Button>
        )}
        <div role="group" aria-label="Filtrar por tipo" className="flex basis-full flex-wrap gap-1.5">
          <button type="button" aria-pressed={!filtroTipo} onClick={() => onFiltroTipoChange("")} className={chipClass(!filtroTipo)}>
            Todos <span className={filtroTipo ? "text-ink-subtle" : ""}>{templates.length}</span>
          </button>
          {tipos.map(([tipo, quantidade]) => {
            const ativo = filtroTipo === tipo;
            return (
              <button key={tipo} type="button" aria-pressed={ativo} onClick={() => onFiltroTipoChange(ativo ? "" : tipo)} className={chipClass(ativo)}>
                {tipo} <span className={ativo ? "" : "text-ink-subtle"}>{quantidade}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-surface-subtle px-4 py-2">
          <span className="text-sm font-semibold text-ink" aria-live="polite">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => onBulkToggleAtivo(true)}>
              Ativar
            </Button>
            <Button variant="secondary" onClick={() => onBulkToggleAtivo(false)}>
              Desativar
            </Button>
            <Button variant="danger" onClick={onBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Excluindo..." : `Excluir ${selected.size}`}
            </Button>
            <Button variant="quiet" onClick={onSelectNone}>
              Cancelar seleção
            </Button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <div
          className={`${TEMPLATE_GRID} border-y border-gray-200 bg-surface-subtle px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted`}
        >
          <label className="-m-3 flex cursor-pointer p-3">
            <input
              ref={todosRef}
              type="checkbox"
              checked={todosSelecionados}
              disabled={templatesFiltrados.length === 0}
              onChange={() =>
                todosSelecionados ? onSelectNone() : onSelectAll(templatesFiltrados.map((t) => t.id))
              }
              aria-label="Selecionar todos os templates da lista"
              className="h-4 w-4 rounded border-gray-300"
            />
          </label>
          <span aria-live="polite">
            Nome (A–Z) · {templatesFiltrados.length}
            {templatesFiltrados.length !== templates.length ? ` de ${templates.length}` : ""}
          </span>
          <span>Tipo</span>
          <span>IA</span>
          <span>Ativo</span>
          <span className="sr-only">Ações</span>
        </div>
      )}

      {templates.length === 0 && (
        <p className="border-t border-gray-200 px-4 py-6 text-sm text-ink-muted">
          Nenhum template cadastrado. Use <strong>+ Importar templates</strong> para começar.
        </p>
      )}

      {templates.length > 0 && templatesFiltrados.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-ink-muted">Nenhum template encontrado com os filtros aplicados.</p>
      )}

      <ul className="divide-y divide-gray-200">
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
    </section>
  );
}
