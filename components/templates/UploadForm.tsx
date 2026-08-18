"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { Feedback } from "@/components/ui/Status";
import { PADROES, PADROES_LABEL, PROCESSING_TYPES, TIPOS } from "@/components/templates/constants";

export interface UploadFormState {
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
}

interface UploadFormProps {
  form: UploadFormState;
  onFormChange: (form: UploadFormState) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent) => void;
  uploading: boolean;
  error: string;
}

export function UploadForm({ form, onFormChange, onFileChange, onSubmit, uploading, error }: UploadFormProps) {
  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-lg border border-gray-200 bg-surface-card p-5">
      <h2 className="font-display text-base text-ink mb-4">Adicionar template manualmente</h2>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="template-nome" className="mb-1 block text-sm font-semibold text-ink">
            Nome do template
          </label>
          <input
            id="template-nome"
            type="text"
            value={form.nome}
            onChange={(e) => onFormChange({ ...form, nome: e.target.value })}
            placeholder="ex: POP Micropigmentação Labial"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="template-tipo" className="mb-1 block text-sm font-semibold text-ink">
            Tipo
          </label>
          <select
            id="template-tipo"
            value={form.tipo}
            onChange={(e) => onFormChange({ ...form, tipo: e.target.value })}
            className={fieldClass}
          >
            {TIPOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="template-padrao" className="mb-1 block text-sm font-semibold text-ink">
            Padrão de cabeçalho
          </label>
          <select
            id="template-padrao"
            value={form.padraoHeader}
            onChange={(e) => onFormChange({ ...form, padraoHeader: e.target.value })}
            className={fieldClass}
          >
            {PADROES.map((p) => (
              <option key={p} value={p}>
                {p} — {PADROES_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="template-processamento" className="mb-1 block text-sm font-semibold text-ink">
            Processamento <span className="font-normal text-ink-subtle">(detectado automaticamente)</span>
          </label>
          <select
            id="template-processamento"
            value={form.processingType}
            onChange={(e) => onFormChange({ ...form, processingType: e.target.value })}
            className={fieldClass}
          >
            {PROCESSING_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="template-arquivo" className="mb-1 block text-sm font-semibold text-ink">
            Arquivo .docx
          </label>
          <input
            id="template-arquivo"
            type="file"
            accept=".docx"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="block w-full text-sm text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-surface-subtle file:px-3 file:py-1.5 file:text-ink"
          />
        </div>
      </div>
      {error && (
        <Feedback tone="erro" live className="mb-3">
          {error}
        </Feedback>
      )}
      <Button type="submit" disabled={uploading}>
        {uploading ? "Enviando..." : "Adicionar template"}
      </Button>
    </form>
  );
}
