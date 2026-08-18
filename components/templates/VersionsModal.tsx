"use client";

import { useRef } from "react";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";
import { getPtInfo, type Template, type TemplateVersion } from "@/components/templates/constants";

interface VersionsModalProps {
  template: Template;
  versoes: TemplateVersion[];
  onRestaurar: (templateId: string, versaoId: string) => void;
  onClose: () => void;
  restoringVersion: string | null;
}

export function VersionsModal({ template, versoes, onRestaurar, onClose, restoringVersion }: VersionsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard(true, onClose, dialogRef, fecharRef);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="versoes-titulo"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-200 bg-surface-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="versoes-titulo" className="font-display text-lg text-ink">
              Versões do template
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">{template.nome}</p>
          </div>
          <button ref={fecharRef} onClick={onClose} className="text-xl leading-none text-ink-subtle hover:text-ink">
            ✕
          </button>
        </div>
        {versoes.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
            Ainda não há versões anteriores para este template. A partir de agora, edições e importações guardam histórico automaticamente.
          </p>
        ) : (
          <div className="space-y-2">
            {versoes.map((versao) => (
              <div key={versao.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{versao.nome}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {new Date(versao.criadaEm).toLocaleString("pt-BR")} · {versao.tipo} · {getPtInfo(versao.processingType).label}
                  </p>
                  {versao.motivo && <p className="mt-1 text-xs text-ink-subtle">{versao.motivo}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onRestaurar(template.id, versao.id)}
                  disabled={restoringVersion === versao.id}
                  className="shrink-0 rounded-lg border border-brand-focus px-3 py-1.5 text-xs text-brand-accent hover:bg-surface-subtle disabled:opacity-50"
                >
                  {restoringVersion === versao.id ? "Restaurando..." : "Restaurar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
