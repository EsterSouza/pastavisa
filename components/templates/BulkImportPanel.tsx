"use client";

import { Button } from "@/components/ui/Button";
import type { BulkImportResult } from "@/components/templates/constants";

interface BulkImportPanelProps {
  bulkFiles: File[];
  onFilesChange: (files: File[]) => void;
  onImport: () => void;
  importing: boolean;
  importResults: BulkImportResult[];
}

const RESULTADO_COR: Record<string, string> = {
  erro: "text-status-danger",
  atualizado: "text-brand-accent",
  importado: "text-status-success",
};

/** Importação em lote, mostrada dentro do painel "Importar templates". */
export function BulkImportPanel({ bulkFiles, onFilesChange, onImport, importing, importResults }: BulkImportPanelProps) {
  return (
    <div className="space-y-3">
      <label
        htmlFor="importar-docx"
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-400 px-4 py-6 text-center focus-within:ring-2 focus-within:ring-brand-focus hover:bg-surface-subtle ${
          importing ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <span className="font-semibold text-ink">Escolher arquivos .docx</span>
        <span className="text-sm text-ink-muted">
          Pode selecionar vários. Se o nome já existir, o template ativo é atualizado e a versão anterior fica no
          histórico.
        </span>
        <input
          id="importar-docx"
          type="file"
          accept=".docx"
          multiple
          onChange={(e) => onFilesChange(Array.from(e.target.files || []))}
          disabled={importing}
          className="sr-only"
        />
      </label>

      {bulkFiles.length > 0 && (
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{bulkFiles.length} selecionado(s):</span>{" "}
          {bulkFiles.map((selectedFile) => selectedFile.name).join(", ")}
        </p>
      )}

      <Button type="button" onClick={onImport} disabled={importing || bulkFiles.length === 0} className="w-full">
        {importing
          ? "Importando..."
          : bulkFiles.length > 0
          ? `Importar ou atualizar ${bulkFiles.length} template${bulkFiles.length > 1 ? "s" : ""}`
          : "Escolha os arquivos primeiro"}
      </Button>

      {importResults.length > 0 && (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-surface-subtle px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <span>Template</span>
            <span>Resultado</span>
            <span>Validação</span>
          </div>
          {importResults.map((result, index) => (
            <div
              key={`${result.nome}-${index}`}
              className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-gray-200 px-3 py-2 text-sm"
            >
              <span className="truncate text-ink" title={result.nome}>
                {result.nome}
              </span>
              <span className={`font-semibold ${RESULTADO_COR[result.status] || "text-ink-muted"}`}>{result.status}</span>
              <span className={result.status === "erro" || (result.errosValidacao || 0) > 0 ? "text-status-danger" : "text-ink-muted"}>
                {result.status === "erro" ? result.error : `${result.variaveis ?? 0} variáveis, ${result.errosValidacao ?? 0} erro(s)`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
