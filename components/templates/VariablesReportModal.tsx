"use client";

import { useRef } from "react";
import { buttonClass } from "@/components/ui/Button";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";
import { findTemplateVariable } from "@/lib/template-variables";
import type { TemplateValidationReport } from "@/components/templates/constants";
import { VariableCard } from "@/components/templates/VariableLibrary";

interface VariablesReportModalProps {
  nome: string;
  report: TemplateValidationReport;
  onClose: () => void;
  copiedTag: string;
  onCopyTag: (tag: string) => void;
}

export function VariablesReportModal({ nome, report, onClose, copiedTag, onCopyTag }: VariablesReportModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard(true, onClose, dialogRef, fecharRef);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnostico-titulo"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-gray-200 bg-surface-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="diagnostico-titulo" className="font-display text-lg text-ink">
              Diagnóstico do template
            </h2>
            <p className="mt-0.5 max-w-xs truncate text-sm text-ink-muted">{nome}</p>
          </div>
          <button ref={fecharRef} onClick={onClose} className="text-xl leading-none text-ink-subtle hover:text-ink">
            ✕
          </button>
        </div>
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            report.valid ? "border-status-success bg-status-success-soft text-status-success" : "border-status-danger bg-status-danger-soft text-status-danger"
          }`}
        >
          {report.valid
            ? "Template válido: nenhuma tag desconhecida ou marcador quebrado foi detectado."
            : "Este template precisa de correção antes de ser usado com segurança."}
        </div>

        {report.issues.length > 0 && (
          <div className="mb-5 space-y-2">
            {report.issues.map((issue, index) => (
              <p
                key={`${issue.level}-${index}`}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  issue.level === "error"
                    ? "border-status-danger bg-status-danger-soft text-status-danger"
                    : issue.level === "warning"
                    ? "border-status-warning bg-status-warning-soft text-status-warning"
                    : "border-brand-focus bg-surface-subtle text-brand-accent"
                }`}
              >
                {issue.message}
              </p>
            ))}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">Tags utilizadas ({report.variaveis.length})</h3>
            {report.variaveis.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhuma tag encontrada neste arquivo.</p>
            ) : (
              <div className="space-y-2">
                {report.variaveis.map((key) => {
                  const variable = findTemplateVariable(key);
                  return variable ? (
                    <VariableCard key={key} variable={variable} used copiedTag={copiedTag} onCopyTag={onCopyTag} />
                  ) : (
                    <div key={key} className="flex justify-between gap-2 rounded-lg border border-status-danger bg-status-danger-soft p-3">
                      <div>
                        <code className="text-xs font-semibold text-status-danger">{`{${key}}`}</code>
                        <p className="mt-1 text-xs text-status-danger">Esta tag não existe no preenchimento atual.</p>
                      </div>
                      <button type="button" onClick={() => onCopyTag(`{${key}}`)} className="text-xs text-brand-accent hover:underline">
                        Copiar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Automações detectadas</h3>
              <p className="text-xs text-ink">
                Blocos de IA: <span className="font-medium">{report.blocosIa}</span>
              </p>
              <p className="mt-1 text-xs text-ink">
                Condicionais: <span className="font-medium">{report.condicionais.length}</span>
              </p>
              {report.condicionais.map((condition) => (
                <code
                  key={condition.key}
                  className={`mt-2 block rounded px-2 py-1 text-xs ${
                    condition.valid ? "bg-status-success-soft text-status-success" : "bg-status-danger-soft text-status-danger"
                  }`}
                >
                  {`{#${condition.key}}...{/${condition.key}}`}
                </code>
              ))}
            </div>
            <div className="rounded-lg border border-gray-200 bg-surface-subtle p-3">
              <p className="text-xs font-medium text-ink">Como adicionar outra variável</p>
              <p className="mt-1 text-xs text-ink-muted">
                Use a Biblioteca de variáveis acima para copiar a tag exata e inserir no DOCX. Depois reabra este diagnóstico para conferir.
              </p>
            </div>
          </section>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className={buttonClass("secondary")}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
