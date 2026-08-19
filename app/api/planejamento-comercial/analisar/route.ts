import { NextRequest, NextResponse } from "next/server";
import { createCommercialPlan } from "@/lib/commercial-planner/index.server";
import {
  calculatePlannerPrice,
  isPlannerFormat,
  type PlannerFormat,
} from "@/lib/commercial-planner/pricing";
import { logPlannerRequest } from "@/lib/commercial-planner/safe-logging";
import { signPlan } from "@/lib/commercial-planner/signed-plan";
import {
  MAX_PLANNER_BODY_BYTES,
  MAX_PROCEDURES_BYTES,
  validatePlannerInput,
  PlannerValidationError,
} from "@/lib/commercial-planner/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let payloadBytes = 0;
  let procedureBytes = 0;
  let procedures = 0;
  let documents = 0;

  function response(body: unknown, status: number) {
    logPlannerRequest({
      requestId,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      status,
      quantities: { payloadBytes, procedureBytes, procedures, documents },
    });
    return NextResponse.json(body, {
      status,
      headers: { ...NO_STORE_HEADERS, "X-Request-Id": requestId },
    });
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const declaredLength = Number(request.headers.get("content-length"));
  if (contentType !== "application/json") {
    return response({ error: "Envie o planejamento em JSON." }, 400);
  }
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PLANNER_BODY_BYTES) {
    return response({ error: "O corpo da solicitação excede 12 KB." }, 400);
  }

  let raw: unknown;
  try {
    const text = await request.text();
    payloadBytes = bytes(text);
    if (!text || payloadBytes > MAX_PLANNER_BODY_BYTES) {
      return response({ error: "O corpo da solicitação é inválido ou excede 12 KB." }, 400);
    }
    raw = JSON.parse(text);
  } catch {
    return response({ error: "JSON inválido." }, 400);
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return response({ error: "O corpo da solicitação deve ser um objeto JSON." }, 400);
  }

  const record = raw as Record<string, unknown>;
  procedureBytes = typeof record.procedimentos === "string" ? bytes(record.procedimentos) : 0;
  if (procedureBytes > MAX_PROCEDURES_BYTES) {
    return response({ error: "Os procedimentos excedem 8 KB." }, 422);
  }
  if (!isPlannerFormat(record.formato)) {
    return response({ error: "Escolha um formato de entrega válido." }, 422);
  }

  try {
    const input = validatePlannerInput(record);
    const plan = await createCommercialPlan(input);
    procedures = plan.resumo.totalProcedimentos;
    documents = plan.resumo.totalDocumentos;
    const preco = calculatePlannerPrice(procedures, record.formato as PlannerFormat);
    const prazo = {
      diasUteis: 15,
      sujeitoConfirmacaoTecnica: procedures > 100,
    };
    // O token carrega so o que o PDF nao consegue refazer sozinho. Documentos saem
    // porque vinculos ja tem nome e tipo; preco, prazo, resumo e aviso saem porque o
    // servidor os recalcula na hora do download.
    //
    // A ressalva de legislacao tambem fica de fora: e o token que alimenta o PDF, e o
    // que nao entra nele nao tem como chegar ao cliente por descuido de redacao.
    const reservados = new Set(plan.alertasReservados);
    const token = signPlan({
      cliente: input.cliente,
      municipio: input.municipio,
      uf: input.uf,
      plano: {
        procedimentos: plan.procedimentos,
        vinculos: plan.vinculos,
        alertas: plan.alertas.filter((alerta) => !reservados.has(alerta)),
      },
    });

    return response({ ...plan, preco, prazo, token }, 200);
  } catch (error) {
    if (error instanceof PlannerValidationError) {
      return response({ error: error.message }, 422);
    }
    return response({ error: "O planejamento está temporariamente indisponível." }, 503);
  }
}
