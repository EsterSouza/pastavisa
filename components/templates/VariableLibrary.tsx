"use client";

import { fieldClass } from "@/components/ui/Field";
import {
  TEMPLATE_SPECIAL_SYNTAX,
  TEMPLATE_VARIABLE_CATEGORIES,
  TEMPLATE_VARIABLES,
  type TemplateVariableDefinition,
} from "@/lib/template-variables";

interface VariableLibraryProps {
  open: boolean;
  onToggle: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  copiedTag: string;
  onCopyTag: (tag: string) => void;
}

export function VariableCard({
  variable,
  used = false,
  copiedTag,
  onCopyTag,
}: {
  variable: TemplateVariableDefinition;
  used?: boolean;
  copiedTag: string;
  onCopyTag: (tag: string) => void;
}) {
  return (
    <div className={`rounded-lg border p-3 ${used ? "border-status-success bg-status-success-soft/40" : "border-gray-200 bg-surface-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <code className="text-xs font-semibold text-brand-navy">{variable.tag}</code>
          {variable.legacy && <span className="ml-2 text-[10px] text-status-warning">legado</span>}
        </div>
        <button type="button" onClick={() => onCopyTag(variable.tag)} className="shrink-0 text-xs text-brand-accent hover:underline">
          {copiedTag === variable.tag ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink">{variable.description}</p>
      <p className="mt-1 text-[11px] text-ink-muted">Exemplo: {variable.example || "(vazio até ser informado)"}</p>
      <p className="mt-1 text-[11px] text-ink-subtle">{variable.use}</p>
    </div>
  );
}

export function VariableLibrary({
  open,
  onToggle,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  copiedTag,
  onCopyTag,
}: VariableLibraryProps) {
  const catalogVariables = TEMPLATE_VARIABLES.filter((variable) => {
    const q = search.trim().toLowerCase();
    const text = `${variable.key} ${variable.description} ${variable.use}`.toLowerCase();
    return (!q || text.includes(q)) && (!category || variable.category === category);
  });

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-surface-card">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="font-display text-base text-ink">Biblioteca de variáveis</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Tags disponíveis para qualquer template. Copie e cole no DOCX onde o preenchimento deve aparecer.
          </p>
        </div>
        <button type="button" onClick={onToggle} className="shrink-0 text-sm text-brand-accent hover:underline">
          {open ? "Ocultar" : "Abrir biblioteca"}
        </button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-gray-100 p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar variável ou finalidade..."
              aria-label="Buscar variável ou finalidade"
              className={`flex-1 ${fieldClass}`}
            />
            <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className={fieldClass} aria-label="Categoria da variável">
              <option value="">Todas as categorias</option>
              {TEMPLATE_VARIABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {catalogVariables.map((variable) => (
              <VariableCard key={variable.key} variable={variable} copiedTag={copiedTag} onCopyTag={onCopyTag} />
            ))}
          </div>
          {catalogVariables.length === 0 && <p className="text-sm text-ink-muted">Nenhuma variável encontrada com estes filtros.</p>}
          <div className="rounded-lg border border-gray-200 bg-surface-subtle p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Recursos de preenchimento avançado</h3>
            <div className="space-y-3">
              {TEMPLATE_SPECIAL_SYNTAX.map((syntax) => (
                <div key={syntax.label}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-ink">{syntax.label}</span>
                    <code className="rounded border border-gray-200 bg-surface-card px-2 py-1 text-xs text-ink">{syntax.syntax}</code>
                    <button type="button" onClick={() => onCopyTag(syntax.syntax)} className="text-xs text-brand-accent hover:underline">
                      {copiedTag === syntax.syntax ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{syntax.description}</p>
                  <p className="mt-1 text-[11px] text-ink-subtle">Exemplo: {syntax.example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
