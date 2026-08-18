export const PLANNER_STEPS = ["Cliente", "Operação", "Revisão", "Formato e preço"] as const;

export type PlannerStep = 0 | 1 | 2 | 3;

export function PlannerSteps({ atual }: { atual: PlannerStep }) {
  return (
    <nav aria-label="Etapas do planejamento" className="mb-8">
      <ol className="flex flex-wrap gap-x-6 gap-y-2">
        {PLANNER_STEPS.map((rotulo, indice) => {
          const concluida = indice < atual;
          const ativa = indice === atual;
          return (
            <li key={rotulo} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  ativa
                    ? "border-brand-action bg-brand-action text-white"
                    : concluida
                      ? "border-brand-action bg-brand-pale text-brand-action"
                      : "border-gray-300 bg-surface-card text-ink-subtle"
                }`}
              >
                {indice + 1}
              </span>
              <span
                aria-current={ativa ? "step" : undefined}
                className={ativa ? "font-semibold text-ink" : "text-ink-muted"}
              >
                <span className="sr-only">{`Etapa ${indice + 1} de ${PLANNER_STEPS.length}: `}</span>
                {rotulo}
                {concluida && <span className="sr-only"> (concluída)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
