"use client";

import { calculatePlannerPrice, PLANNER_FORMATS, type PlannerFormat } from "@/lib/commercial-planner/pricing";
import type { WithdrawalResult } from "@/lib/commercial-planner/withdrawal";

const FORMAT_LABEL: Record<PlannerFormat, string> = {
  digital: "Pasta digital",
  "preto-e-branco": "Impressa em preto e branco + digital",
  colorida: "Impressa colorida + digital",
};

const FORMAT_DETAIL: Record<PlannerFormat, string> = {
  digital: "Arquivos prontos para uso e impressão pela própria clínica.",
  "preto-e-branco": "Pasta física impressa em preto e branco, com a versão digital junto.",
  colorida: "Pasta física impressa colorida, com a versão digital junto.",
};

function money(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface FormatStepProps {
  retirada: WithdrawalResult;
  formato: PlannerFormat;
  onSelect: (formato: PlannerFormat) => void;
}

export function FormatStep({ retirada, formato, onSelect }: FormatStepProps) {
  const preco = calculatePlannerPrice(retirada.totalDocumentos, formato);
  const prazoSujeito = retirada.totalDocumentos > 100;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl text-ink">Escolha o formato de entrega</h2>
        <p className="mt-2 text-base leading-6 text-ink-muted">
          Os três formatos usam o mesmo conteúdo. O valor final é conferido no servidor antes do download.
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">Formato de entrega</legend>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANNER_FORMATS.map((opcao) => {
            const valores = calculatePlannerPrice(retirada.totalDocumentos, opcao);
            const escolhido = opcao === formato;
            return (
              <label
                key={opcao}
                className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-5 ${
                  escolhido ? "border-brand-action bg-brand-pale shadow-sm" : "border-gray-200 bg-surface-card hover:bg-surface-subtle"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="formato"
                    value={opcao}
                    checked={escolhido}
                    onChange={() => onSelect(opcao)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--color-blue))]"
                  />
                  <span className="font-display text-base text-ink">{FORMAT_LABEL[opcao]}</span>
                </span>
                <span className="font-display text-2xl text-ink">{money(valores.valorTotal)}</span>
                <span className="text-sm leading-5 text-ink-muted">{FORMAT_DETAIL[opcao]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="resumo-valor" className="rounded-lg border border-gray-200 bg-surface-card p-5">
        <h3 id="resumo-valor" className="font-display text-base text-ink">
          Resumo do pedido
        </h3>
        <dl className="mt-4 space-y-2 text-base">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Procedimentos considerados</dt>
            <dd className="font-semibold text-ink">{retirada.totalProcedimentos}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Documentos previstos</dt>
            <dd className="font-semibold text-ink">{retirada.totalDocumentos}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Valor base</dt>
            <dd className="font-semibold text-ink">{money(preco.valorBase)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Adicional por volume acima de 100 documentos</dt>
            <dd className="font-semibold text-ink">{money(preco.valorAdicional)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-gray-200 pt-3">
            <dt className="font-display text-lg text-ink">Total</dt>
            <dd className="font-display text-lg text-ink" aria-live="polite">
              {money(preco.valorTotal)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-ink-muted">
          Prazo de 15 dias úteis
          {prazoSujeito ? ", sujeito à confirmação técnica por passar de 100 documentos." : "."}
        </p>
      </section>
    </div>
  );
}
