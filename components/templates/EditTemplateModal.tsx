"use client";

import { useRef, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";
import { PADROES, PADROES_LABEL, PROCESSING_TYPES, TIPOS, type Template } from "@/components/templates/constants";

const VARIAVEIS_FREQUENTES = [
  "{cliente_nome_fantasia}",
  "{cliente_logo}",
  "{cliente_memorial_descritivo_mbp}",
  "{cliente_servicos_lista}",
  "{texto_legislacao_federal}",
];

interface EditTemplateModalProps {
  editando: Template;
  onChange: (t: Template) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  saving: boolean;
  copiedTag: string;
  onCopyTag: (tag: string) => void;
}

export function EditTemplateModal({ editando, onChange, onSubmit, onClose, saving, copiedTag, onCopyTag }: EditTemplateModalProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  useDialogKeyboard(true, onClose, dialogRef, nomeRef);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-template-titulo"
        onSubmit={onSubmit}
        className="w-full max-w-3xl space-y-4 rounded-lg border border-gray-200 bg-surface-card p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 id="editar-template-titulo" className="font-display text-lg text-ink">
            Editar metadados
          </h2>
          <button type="button" onClick={onClose} className="text-xl leading-none text-ink-subtle hover:text-ink">
            ✕
          </button>
        </div>
        <div>
          <label htmlFor="editar-nome" className="mb-1 block text-sm font-semibold text-ink">
            Nome
          </label>
          <input
            ref={nomeRef}
            id="editar-nome"
            type="text"
            value={editando.nome}
            onChange={(e) => onChange({ ...editando, nome: e.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="editar-tipo" className="mb-1 block text-sm font-semibold text-ink">
              Tipo
            </label>
            <select id="editar-tipo" value={editando.tipo} onChange={(e) => onChange({ ...editando, tipo: e.target.value })} className={fieldClass}>
              {TIPOS.map((tp) => (
                <option key={tp}>{tp}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="editar-padrao" className="mb-1 block text-sm font-semibold text-ink">
              Padrão de cabeçalho
            </label>
            <select
              id="editar-padrao"
              value={editando.padraoHeader}
              onChange={(e) => onChange({ ...editando, padraoHeader: e.target.value })}
              className={fieldClass}
            >
              {PADROES.map((p) => (
                <option key={p} value={p}>
                  {p} — {PADROES_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="editar-processamento" className="mb-1 block text-sm font-semibold text-ink">
            Instrução de geração
          </label>
          <select
            id="editar-processamento"
            value={editando.processingType}
            onChange={(e) => onChange({ ...editando, processingType: e.target.value })}
            className={fieldClass}
          >
            {PROCESSING_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-ink-muted">
            Isso controla se o template apenas substitui variáveis ou usa IA leve/moderada/avançada nos blocos [AI_ADAPT_START].
          </p>
        </div>
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-surface-subtle p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-ink">Variáveis mais usadas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VARIAVEIS_FREQUENTES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onCopyTag(tag)}
                  className="rounded border border-gray-200 bg-surface-card px-2 py-1 text-[11px] text-ink hover:bg-surface-subtle"
                >
                  {copiedTag === tag ? "Copiado" : tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink">Como usar instruções</p>
            <p className="mt-2 text-xs text-ink-muted">
              No DOCX, coloque dados fixos com {"{variavel}"} e trechos adaptáveis entre [AI_ADAPT_START] e [AI_ADAPT_END]. Use Validar
              depois de salvar para conferir tags quebradas.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
