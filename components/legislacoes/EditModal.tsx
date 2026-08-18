"use client";

import { useRef, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { Feedback } from "@/components/ui/Status";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";
import { ESTADOS_BR, TIPOS_FORM, type Legislacao } from "@/components/legislacoes/constants";

interface EditModalProps {
  editando: Legislacao;
  onChange: (leg: Legislacao) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}

export function EditModal({ editando, onChange, onSubmit, onClose, saving, error }: EditModalProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const ufRef = useRef<HTMLSelectElement>(null);

  useDialogKeyboard(true, onClose, dialogRef, ufRef);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-legislacao-titulo"
        onSubmit={onSubmit}
        className="w-full max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-surface-card p-6 shadow-lg"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 id="editar-legislacao-titulo" className="font-display text-lg text-ink">
            Editar legislação
          </h2>
          <button type="button" onClick={onClose} className="text-xl leading-none text-ink-subtle hover:text-ink">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="edit-uf" className="mb-1 block text-sm font-semibold text-ink">
              UF
            </label>
            <select ref={ufRef} id="edit-uf" value={editando.estadoUf} onChange={(e) => onChange({ ...editando, estadoUf: e.target.value })} className={fieldClass}>
              {ESTADOS_BR.map((uf) => (
                <option key={uf} value={uf}>
                  {uf === "BR" ? "BR — Federal" : uf}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-municipio" className="mb-1 block text-sm font-semibold text-ink">
              Município
            </label>
            <input
              id="edit-municipio"
              type="text"
              value={editando.municipio || ""}
              onChange={(e) => onChange({ ...editando, municipio: e.target.value || null })}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="edit-tipo" className="mb-1 block text-sm font-semibold text-ink">
              Tipo
            </label>
            <select id="edit-tipo" value={editando.tipo} onChange={(e) => onChange({ ...editando, tipo: e.target.value })} className={fieldClass}>
              {TIPOS_FORM.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="edit-titulo" className="mb-1 block text-sm font-semibold text-ink">
            Título
          </label>
          <input id="edit-titulo" type="text" value={editando.titulo} onChange={(e) => onChange({ ...editando, titulo: e.target.value })} className={fieldClass} />
        </div>
        {error && (
          <Feedback tone="erro" live>
            {error}
          </Feedback>
        )}
        <div>
          <label htmlFor="edit-referencia" className="mb-1 block text-sm font-semibold text-ink">
            Referência ABNT
          </label>
          <textarea
            id="edit-referencia"
            rows={4}
            value={editando.referenciaAbnt}
            onChange={(e) => onChange({ ...editando, referenciaAbnt: e.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="edit-destaque" className="mb-1 block text-sm font-semibold text-ink">
            Trecho em negrito (opcional)
          </label>
          <input
            id="edit-destaque"
            type="text"
            value={editando.destaqueAbnt || ""}
            onChange={(e) => onChange({ ...editando, destaqueAbnt: e.target.value || null })}
            placeholder="Título da obra, manual ou periódico"
            className={fieldClass}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
