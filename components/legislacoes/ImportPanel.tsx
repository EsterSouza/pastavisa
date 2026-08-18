"use client";

import { Feedback } from "@/components/ui/Status";
import { fieldClass } from "@/components/ui/Field";
import { ESTADOS_BR, type ReferenciaImportada } from "@/components/legislacoes/constants";

interface ImportPanelProps {
  importFile: File | null;
  onFileChange: (file: File | null) => void;
  importEstado: string;
  onImportEstadoChange: (value: string) => void;
  importMunicipio: string;
  onImportMunicipioChange: (value: string) => void;
  onAnalisar: () => void;
  importando: boolean;
  importError: string;
  importMsg: string;
  importPreview: string | null;
  referenciasImportadas: ReferenciaImportada[];
  selecionadasImportacao: Set<number>;
  onToggleImportada: (index: number) => void;
  onAdicionarSelecionadas: () => void;
}

export function ImportPanel({
  importFile,
  onFileChange,
  importEstado,
  onImportEstadoChange,
  importMunicipio,
  onImportMunicipioChange,
  onAnalisar,
  importando,
  importError,
  importMsg,
  importPreview,
  referenciasImportadas,
  selecionadasImportacao,
  onToggleImportada,
  onAdicionarSelecionadas,
}: ImportPanelProps) {
  return (
    <section className="mb-6 space-y-4 rounded-lg border border-status-warning bg-surface-card p-5">
      <div>
        <h2 className="font-display text-base text-ink">Importar legislações do Documento em Elaboração</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Envie um DOCX com a seção de referências. O app detecta o que ainda não está na base, remove duplicatas aproximadas e deixa você
          revisar antes de adicionar.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_120px_180px_auto] md:items-end">
        <div>
          <label htmlFor="import-arquivo" className="mb-1 block text-sm font-semibold text-ink">
            Arquivo .docx
          </label>
          <input
            id="import-arquivo"
            type="file"
            accept=".docx"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            disabled={importando}
            className="block w-full text-sm text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-status-warning-soft file:px-3 file:py-1.5 file:text-status-warning hover:file:opacity-90 disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="import-uf" className="mb-1 block text-sm font-semibold text-ink">
            UF padrão
          </label>
          <select
            id="import-uf"
            value={importEstado}
            onChange={(e) => onImportEstadoChange(e.target.value)}
            disabled={importando}
            className={`${fieldClass} disabled:opacity-50`}
          >
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="import-municipio" className="mb-1 block text-sm font-semibold text-ink">
            Município padrão
          </label>
          <input
            id="import-municipio"
            type="text"
            value={importMunicipio}
            onChange={(e) => onImportMunicipioChange(e.target.value)}
            disabled={importando}
            placeholder="opcional"
            className={`${fieldClass} disabled:opacity-50`}
          />
        </div>
        <button
          type="button"
          onClick={onAnalisar}
          disabled={importando || !importFile}
          className="rounded-lg bg-status-warning px-4 py-2 text-sm font-medium text-brand-on-dark hover:opacity-90 disabled:opacity-50"
        >
          {importando ? "Analisando..." : "Analisar"}
        </button>
      </div>

      {importError && (
        <Feedback tone="erro" live>
          {importError}
        </Feedback>
      )}
      {importMsg && (
        <Feedback tone="atencao" live>
          {importMsg}
        </Feedback>
      )}

      {referenciasImportadas.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-status-warning">
          <div className="flex items-center justify-between gap-3 bg-status-warning-soft px-3 py-2">
            <p className="text-xs font-semibold text-status-warning">
              {selecionadasImportacao.size} de {referenciasImportadas.length} selecionada(s)
            </p>
            <button
              type="button"
              onClick={onAdicionarSelecionadas}
              disabled={importando || selecionadasImportacao.size === 0}
              className="rounded bg-status-warning px-3 py-1.5 text-xs font-medium text-brand-on-dark hover:opacity-90 disabled:opacity-50"
            >
              Adicionar selecionadas
            </button>
          </div>
          <ul className="divide-y divide-status-warning/30">
            {referenciasImportadas.map((referencia, index) => (
              <li key={`${referencia.referenciaAbnt}-${index}`} className="flex items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selecionadasImportacao.has(index)}
                  onChange={() => onToggleImportada(index)}
                  aria-label={`Selecionar ${referencia.titulo}`}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-status-warning text-status-warning"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{referencia.titulo}</p>
                  <p className="text-xs text-ink-muted">
                    {referencia.tipo} · {referencia.estadoUf}
                    {referencia.municipio ? ` · ${referencia.municipio}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-ink">{referencia.referenciaAbnt}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {importPreview && referenciasImportadas.length === 0 && (
        <details className="rounded-lg border border-gray-200 bg-surface-subtle px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-ink">Ver texto extraído do DOCX</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-ink-muted">{importPreview}</pre>
        </details>
      )}
    </section>
  );
}
