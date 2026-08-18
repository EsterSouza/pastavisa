"use client";

import { AUTHORSHIP_NOTE, OUT_OF_FOLDER_NOTE } from "@/lib/commercial-planner/references";
import type { PublicCommercialPlan } from "@/lib/commercial-planner/types";
import type { WithdrawalResult } from "@/lib/commercial-planner/withdrawal";

interface ReviewStepProps {
  plano: PublicCommercialPlan;
  retirada: WithdrawalResult;
  retirados: string[];
  onToggle: (procedimento: string, incluir: boolean) => void;
}

export function ReviewStep({ plano, retirada, retirados, onToggle }: ReviewStepProps) {
  const retiradosSet = new Set(retirados);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl text-ink">Revise o que entra na pasta</h2>
        <p className="mt-2 text-base leading-6 text-ink-muted">
          Desmarque um procedimento para retirá-lo. Os documentos e o valor adicional são recalculados na hora, e o
          servidor confere a conta antes do download.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="revisao-procedimentos" className="rounded-lg border border-gray-200 bg-surface-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="revisao-procedimentos" className="font-display text-base text-ink">
              Procedimentos
            </h3>
            <p className="text-sm font-semibold text-ink-muted" aria-live="polite">
              {retirada.totalProcedimentos} de {plano.procedimentos.length}
            </p>
          </div>

          <ul className="mt-4 space-y-1">
            {plano.procedimentos.map((procedimento) => {
              const incluido = !retiradosSet.has(procedimento);
              return (
                <li key={procedimento}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-base hover:bg-surface-subtle">
                    <input
                      type="checkbox"
                      checked={incluido}
                      onChange={(event) => onToggle(procedimento, event.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[rgb(var(--color-blue))]"
                    />
                    <span className={incluido ? "text-ink" : "text-ink-subtle line-through"}>{procedimento}</span>
                    {!incluido && <span className="sr-only">retirado</span>}
                  </label>
                </li>
              );
            })}
          </ul>

          {retirada.totalProcedimentos === 0 && (
            <p role="alert" className="mt-4 rounded-md border border-status-danger bg-status-danger-soft px-3 py-2 text-sm font-medium text-status-danger">
              Mantenha ao menos um procedimento para seguir.
            </p>
          )}
        </section>

        <section aria-labelledby="revisao-documentos" className="rounded-lg border border-gray-200 bg-surface-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="revisao-documentos" className="font-display text-base text-ink">
              Documentos previstos
            </h3>
            <p className="text-sm font-semibold text-ink-muted" aria-live="polite">
              {retirada.totalDocumentos} documento(s)
            </p>
          </div>

          <ul className="mt-4 space-y-2">
            {retirada.documentos.map((documento) => (
              <li key={`${documento.tipo}:${documento.nome}`} className="flex items-start gap-3 text-base">
                <span className="mt-0.5 inline-flex shrink-0 rounded border border-gray-200 bg-brand-pale px-2 py-0.5 text-xs font-semibold uppercase text-brand-action">
                  {documento.tipo}
                </span>
                <span className="text-ink">{documento.nome}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 border-t border-gray-200 pt-4 text-sm leading-6 text-ink-muted">
            {AUTHORSHIP_NOTE} {OUT_OF_FOLDER_NOTE}
          </p>
        </section>
      </div>

      {plano.alertas.length > 0 && (
        <section aria-labelledby="revisao-alertas" className="rounded-lg border border-status-warning bg-status-warning-soft p-5">
          <h3 id="revisao-alertas" className="font-display text-base text-status-warning">
            Pontos que a equipe técnica precisa confirmar
          </h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-6 text-ink">
            {plano.alertas.map((alerta) => (
              <li key={alerta}>{alerta}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm leading-6 text-ink-muted">{plano.aviso}</p>
    </div>
  );
}
