"use client";

import { buttonClass } from "@/components/ui/Button";
import type { BulkImportResult } from "@/components/templates/constants";

interface BulkImportPanelProps {
  bulkFiles: File[];
  onFilesChange: (files: File[]) => void;
  onImport: () => void;
  importing: boolean;
  importResults: BulkImportResult[];
}

export function BulkImportPanel({ bulkFiles, onFilesChange, onImport, importing, importResults }: BulkImportPanelProps) {
  return (
    <section className="mb-6 rounded-lg border border-status-success bg-surface-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-base text-ink">Importar ou atualizar templates em lote</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Selecione os DOCX novos ou substituídos. Se o nome já existir, o app atualiza o template ativo.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:min-w-[360px]">
          <input
            type="file"
            accept=".docx"
            multiple
            onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
            disabled={importing}
            aria-label="Selecionar arquivos DOCX para importação em lote"
            className="block w-full text-sm text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-status-success-soft file:px-3 file:py-1.5 file:text-status-success hover:file:opacity-90 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={onImport}
            disabled={importing || bulkFiles.length === 0}
            className={buttonClass("primary")}
          >
            {importing
              ? "Importando..."
              : bulkFiles.length > 0
              ? `Importar/atualizar ${bulkFiles.length} template${bulkFiles.length > 1 ? "s" : ""}`
              : "Selecionar DOCX para importar"}
          </button>
        </div>
      </div>
      {bulkFiles.length > 0 && (
        <p className="mt-3 text-sm text-ink-muted">
          Selecionados: {bulkFiles.map((selectedFile) => selectedFile.name).join(", ")}
        </p>
      )}
      {importResults.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-surface-subtle px-3 py-2 text-xs font-medium text-ink-muted">
            <span>Template</span>
            <span>Status</span>
            <span>Validação</span>
          </div>
          {importResults.map((result, index) => (
            <div
              key={`${result.nome}-${index}`}
              className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-gray-100 px-3 py-2 text-xs"
            >
              <span className="truncate text-ink" title={result.nome}>
                {result.nome}
              </span>
              <span
                className={
                  result.status === "erro"
                    ? "text-status-danger"
                    : result.status === "atualizado"
                    ? "text-brand-accent"
                    : "text-status-success"
                }
              >
                {result.status}
              </span>
              <span className={result.status === "erro" || (result.errosValidacao || 0) > 0 ? "text-status-danger" : "text-ink-muted"}>
                {result.status === "erro" ? result.error : `${result.variaveis ?? 0} variáveis, ${result.errosValidacao ?? 0} erro(s)`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
