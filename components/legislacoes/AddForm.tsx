"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { Feedback } from "@/components/ui/Status";
import { ESTADOS_BR, TIPOS_FORM } from "@/components/legislacoes/constants";

export interface AddFormState {
  estadoUf: string;
  municipio: string;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt: string;
}

interface AddFormProps {
  form: AddFormState;
  onFormChange: (form: AddFormState) => void;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  error: string;
}

export function AddForm({ form, onFormChange, onSubmit, saving, error }: AddFormProps) {
  return (
    <form onSubmit={onSubmit} className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-surface-card p-5">
      <h2 className="font-display text-base text-ink">Adicionar legislação</h2>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label htmlFor="legislacao-uf" className="mb-1 block text-sm font-semibold text-ink">
            UF
          </label>
          <select id="legislacao-uf" value={form.estadoUf} onChange={(e) => onFormChange({ ...form, estadoUf: e.target.value })} className={fieldClass}>
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf}>
                {uf === "BR" ? "BR — Federal" : uf}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="legislacao-municipio" className="mb-1 block text-sm font-semibold text-ink">
            Município (opcional)
          </label>
          <input
            id="legislacao-municipio"
            type="text"
            value={form.municipio}
            placeholder="Deixe vazio = estadual"
            onChange={(e) => onFormChange({ ...form, municipio: e.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="legislacao-tipo" className="mb-1 block text-sm font-semibold text-ink">
            Tipo
          </label>
          <select id="legislacao-tipo" value={form.tipo} onChange={(e) => onFormChange({ ...form, tipo: e.target.value })} className={fieldClass}>
            {TIPOS_FORM.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="legislacao-titulo" className="mb-1 block text-sm font-semibold text-ink">
            Título
          </label>
          <input
            id="legislacao-titulo"
            type="text"
            value={form.titulo}
            placeholder="ex: Lei Complementar nº 70/2009"
            onChange={(e) => onFormChange({ ...form, titulo: e.target.value })}
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="legislacao-referencia" className="mb-1 block text-sm font-semibold text-ink">
          Referência ABNT completa
        </label>
        <textarea
          id="legislacao-referencia"
          rows={3}
          value={form.referenciaAbnt}
          placeholder="AMAZONAS. Lei Complementar nº 70, de 03 de dezembro de 2009..."
          onChange={(e) => onFormChange({ ...form, referenciaAbnt: e.target.value })}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="legislacao-destaque" className="mb-1 block text-sm font-semibold text-ink">
          Trecho em negrito na referência (opcional)
        </label>
        <input
          id="legislacao-destaque"
          type="text"
          value={form.destaqueAbnt}
          placeholder="Título do manual, periódico ou obra a destacar"
          onChange={(e) => onFormChange({ ...form, destaqueAbnt: e.target.value })}
          className={fieldClass}
        />
        <p className="mt-1 text-sm text-ink-muted">Para leis e resoluções, o app identifica automaticamente o ato normativo.</p>
      </div>
      {error && (
        <Feedback tone="erro" live>
          {error}
        </Feedback>
      )}
      <Button type="submit" disabled={saving || !form.titulo || !form.referenciaAbnt}>
        {saving ? "Salvando..." : "Adicionar"}
      </Button>
    </form>
  );
}
