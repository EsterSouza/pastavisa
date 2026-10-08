"use client";

import { ActionMenu } from "@/components/ui/ActionMenu";
import type { Tone } from "@/components/ui/Status";
import { getPtInfo, PADROES_LABEL, PROCESSING_TYPES, type Template } from "@/components/templates/constants";

// Só usa as famílias de cor existentes em tailwind.config (gray/blue/amber/red):
// roxo e índigo do painel antigo não tinham token e saíam sem cor nenhuma.
const TONE_SELECT_CLASS: Record<Tone, string> = {
  neutro: "border-gray-300 bg-surface-subtle text-ink-muted",
  info: "border-brand-focus bg-surface-subtle text-brand-accent",
  sucesso: "border-status-success bg-status-success-soft text-status-success",
  atencao: "border-status-warning bg-status-warning-soft text-status-warning",
  erro: "border-status-danger bg-status-danger-soft text-status-danger",
};

// Colunas: seleção, nome, tipo, IA, ativo, ações. Compartilhada com o cabeçalho
// da lista em TemplateList.
export const TEMPLATE_GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_11.5rem_4.5rem_8.5rem] items-center gap-3";

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
    <li className={`${TEMPLATE_GRID} px-4 py-2.5 ${selected ? "bg-surface-subtle" : "hover:bg-surface-subtle"}`}>
      <label className="-m-3 flex cursor-pointer p-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(t.id)}
          aria-label={`Selecionar ${t.nome}`}
          className="h-4 w-4 rounded border-gray-300"
        />
      </label>

      <div className="min-w-0">
        <p className={`break-words text-sm font-semibold leading-snug ${t.ativo ? "text-ink" : "text-ink-subtle line-through decoration-1"}`}>
          {t.nome}
        </p>
        <p className="text-sm text-ink-muted">
          Cabeçalho {t.padraoHeader} ({PADROES_LABEL[t.padraoHeader] || "—"}) · {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
          {!t.ativo && " · inativo, não aparece na geração"}
        </p>
      </div>

      <div>
        <span className="inline-flex rounded-full border border-gray-200 bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-ink-muted">
          {t.tipo}
        </span>
      </div>

      <select
        value={t.processingType}
        onChange={(e) => onUpdateProcessingType(t.id, e.target.value)}
        aria-label={`Processamento de ${t.nome}`}
        className={`min-h-9 w-full cursor-pointer rounded-md border px-2 text-sm font-semibold ${TONE_SELECT_CLASS[ptInfo.tone]}`}
      >
        {PROCESSING_TYPES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <div>
        <button
          type="button"
          role="switch"
          aria-checked={t.ativo}
          aria-label={`Ativo: ${t.nome}`}
          onClick={() => onToggleAtivo(t.id, t.ativo)}
          className="group inline-flex items-center rounded-md px-1 focus-visible:outline-none"
        >
          {/* O botão mantém a área de clique de 44px do globals.css; a pílula é só o desenho. */}
          <span
            aria-hidden="true"
            className={`inline-flex h-6 w-11 items-center rounded-full border-[1.5px] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-brand-focus group-focus-visible:ring-offset-2 ${
              t.ativo ? "border-status-success bg-status-success" : "border-gray-400 bg-surface-subtle"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-surface-card shadow transition-transform ${
                t.ativo ? "translate-x-[1.3rem]" : "translate-x-[0.2rem]"
              }`}
            />
          </span>
        </button>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onVisualizar(t)}
          disabled={loadingPreview}
          aria-label={`Visualizar ${t.nome}`}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-brand-accent underline-offset-4 hover:underline disabled:text-ink-subtle"
        >
          {loadingPreview ? "Abrindo..." : "Visualizar"}
        </button>
        <ActionMenu
          label={`Mais ações de ${t.nome}`}
          items={[
            { label: loadingVars ? "Validando..." : "Validar variáveis", disabled: loadingVars, onSelect: () => onValidar(t) },
            { label: loadingVersions ? "Carregando..." : "Versões anteriores", disabled: loadingVersions, onSelect: () => onVerVersoes(t) },
            { label: "Editar nome e tipo", onSelect: () => onEditar(t) },
            { label: duplicando ? "Duplicando..." : "Duplicar", disabled: duplicando, onSelect: () => onDuplicar(t.id) },
            { label: "Excluir…", destrutiva: true, onSelect: () => onExcluir(t) },
          ]}
        />
      </div>
    </li>
  );
}
