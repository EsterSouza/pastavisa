export interface PlannerRequestLog {
  requestId: string;
  durationMs: number;
  status: number;
  quantities: {
    payloadBytes: number;
    procedureBytes: number;
    procedures: number;
    documents: number;
  };
}

export function logPlannerRequest(entry: PlannerRequestLog): void {
  console.info(JSON.stringify(entry));
}
