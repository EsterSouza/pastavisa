"use client";

import type { Tone } from "@/components/ui/Status";
import { getPtInfo, PADROES_LABEL, PROCESSING_TYPES, type Template } from "@/components/templates/constants";

// Só usa as famílias de cor existentes em tailwind.config (gray/blue/amber/red):
// roxo e índigo do painel antigo não tinham token e saíam sem cor nenhuma.
const TONE_SELECT_CLASS: Record<Tone, string> = {
  neutro: "bg-gray-100 text-ink-muted",
  info: "bg-blue-100 text-brand-navy",
  sucesso: "bg-green-100 text-status-success",
  atencao: "bg-amber-100 text-status-warning",
  erro: "bg-red-100 text-status-danger",
};

interface TemplateListItemProps {
  template: Template;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdateProcessingType: (id: string, processingType: string) => void;
  onVisualizar: (t: Template) => void;
  onValidar: (t: Template) => void;
  onVerVersoes: (t: Template) => void;
  onEditar: (t: Template) => void;
  onDuplicar: (id: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onExcluir: (t: Template) => void;
  loadingPreview: boolean;
  loadingVars: boolean;
  loadingVersions: boolean;
  duplicando: boolean;
}

export function TemplateListItem({
  template: t,
  selected,
  onToggleSelect,
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
}: TemplateListItemProps) {
  const ptInfo = getPtInfo(t.processingType);

  return (
    <li
      className={`flex items-center gap-3 px-5 py-3 transition-colors ${selected ? "bg-surface-subtle" : ""} ${!t.ativo ? "opacity-50" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(t.id)}
        aria-label={`Selecionar ${t.nome}`}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-brand-action"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{t.nome}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t.tipo} · Padrão {t.padraoHeader} ({PADROES_LABEL[t.padraoHeader]}) · {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
        </p>
      </div>

      <select
        value={t.processingType}
        onChange={(e) => onUpdateProcessingType(t.id, e.target.value)}
        aria-label={`Processamento de ${t.nome}`}
        className={`cursor-pointer rounded border-0 px-2 py-1 text-xs font-medium ${TONE_SELECT_CLASS[ptInfo.tone]}`}
      >
        {PROCESSING_TYPES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => onVisualizar(t)}
          disabled={loadingPreview}
          title="Visualizar DOCX do template"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-subtle disabled:opacity-50"
        >
          {loadingPreview ? "..." : "Visualizar"}
        </button>
        <button
          onClick={() => onValidar(t)}
          disabled={loadingVars}
          title="Validar variáveis do template"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-subtle disabled:opacity-50"
        >
          {loadingVars ? "..." : "Validar"}
        </button>
        <button
          onClick={() => onVerVersoes(t)}
          disabled={loadingVersions}
          title="Ver e restaurar versões anteriores"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-subtle disabled:opacity-50"
        >
          {loadingVersions ? "..." : "Versões"}
        </button>
        <button
          onClick={() => onEditar(t)}
          title="Editar metadados"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-subtle"
        >
          Editar
        </button>
        <button
          onClick={() => onDuplicar(t.id)}
          disabled={duplicando}
          title="Duplicar template"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface-subtle disabled:opacity-50"
        >
          {duplicando ? "..." : "Duplicar"}
        </button>
        <button
          onClick={() => onToggleAtivo(t.id, t.ativo)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
            t.ativo
              ? "border-status-success bg-status-success-soft text-status-success hover:opacity-90"
              : "border-gray-300 text-ink-muted hover:bg-surface-subtle"
          }`}
        >
          {t.ativo ? "Ativo" : "Inativo"}
        </button>
        <button
          onClick={() => onExcluir(t)}
          title="Excluir template"
          className="rounded border border-status-danger px-2.5 py-1 text-xs text-status-danger hover:bg-status-danger-soft"
        >
          Excluir
        </button>
      </div>
    </li>
  );
}
