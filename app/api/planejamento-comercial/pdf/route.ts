import { NextRequest, NextResponse } from "next/server";
import {
  calculatePlannerPrice,
  isPlannerFormat,
  PLANNER_FORMATS,
  type PlannerFormat,
} from "@/lib/commercial-planner/pricing";
import { renderPlannerPdf } from "@/lib/commercial-planner/render-pdf";
import { logPlannerRequest } from "@/lib/commercial-planner/safe-logging";
import { InvalidPlanTokenError, verifyPlan } from "@/lib/commercial-planner/signed-plan";
import type { PublicCommercialPlan } from "@/lib/commercial-planner/types";
import { MAX_PLANNER_PDF_BODY_BYTES } from "@/lib/commercial-planner/validation";
import { applyWithdrawal } from "@/lib/commercial-planner/withdrawal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

interface SignedPlanPayload {
  cliente: string;
  municipio?: string;
  uf?: string;
  plano: PublicCommercialPlan;
}

function bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function fileName(cliente: string): string {
  const slug = cliente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `pre-planejamento-${slug || "cliente"}.pdf`;
}

/** O token é assinado, mas a forma ainda é conferida: token antigo pode não ter todos os campos. */
function readPlan(value: unknown): SignedPlanPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const plano = raw.plano as PublicCommercialPlan | undefined;
  if (typeof raw.cliente !== "string" || !plano || !Array.isArray(plano.procedimentos)) return null;
  const vinculos = Array.isArray(plano.vinculos) ? plano.vinculos : [];

  return {
    cliente: raw.cliente,
    municipio: typeof raw.municipio === "string" ? raw.municipio : undefined,
    uf: typeof raw.uf === "string" ? raw.uf : undefined,
    plano: {
      ...plano,
      // Token novo nao carrega `documentos`: nome e tipo ja estão em `vinculos`, e
      // repetir os dois dobrava o tamanho do token. Token antigo ainda traz a lista.
      documentos: Array.isArray(plano.documentos)
        ? plano.documentos
        : vinculos.map((vinculo) => ({ nome: vinculo.documento, tipo: vinculo.tipo })),
      vinculos,
      alertas: Array.isArray(plano.alertas) ? plano.alertas : [],
    },
  };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  let payloadBytes = 0;
  let procedures = 0;
  let documents = 0;

  function finish(status: number) {
    logPlannerRequest({
      requestId,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      status,
      quantities: { payloadBytes, procedureBytes: 0, procedures, documents },
    });
  }

  function failure(message: string, status: number) {
    finish(status);
    return NextResponse.json(
      { error: message },
      { status, headers: { ...NO_STORE_HEADERS, "X-Request-Id": requestId } }
    );
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const declaredLength = Number(request.headers.get("content-length"));
  if (contentType !== "application/json") {
    return failure("Envie o planejamento em JSON.", 400);
  }
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PLANNER_PDF_BODY_BYTES) {
    return failure("O corpo da solicitação excede 64 KB.", 400);
  }

  let raw: unknown;
  try {
    const text = await request.text();
    payloadBytes = bytes(text);
    if (!text || payloadBytes > MAX_PLANNER_PDF_BODY_BYTES) {
      return failure("O corpo da solicitação é inválido ou excede 64 KB.", 400);
    }
    raw = JSON.parse(text);
  } catch {
    return failure("JSON inválido.", 400);
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return failure("O corpo da solicitação deve ser um objeto JSON.", 400);
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.token !== "string" || !record.token) {
    return failure("O planejamento precisa ser refeito.", 422);
  }
  if (!isPlannerFormat(record.formato)) {
    return failure("Escolha um formato de entrega válido.", 422);
  }

  let payload: SignedPlanPayload | null;
  try {
    payload = readPlan(verifyPlan<unknown>(record.token).plan);
  } catch (error) {
    if (error instanceof InvalidPlanTokenError) {
      return failure("O planejamento expirou ou foi alterado. Refaça a análise.", 422);
    }
    return failure("A geração do PDF está temporariamente indisponível.", 503);
  }
  if (!payload) {
    return failure("O planejamento expirou ou foi alterado. Refaça a análise.", 422);
  }

  const retirados = Array.isArray(record.retirados)
    ? record.retirados.filter((item): item is string => typeof item === "string").slice(0, 500)
    : [];
  const withdrawal = applyWithdrawal(payload.plano, retirados);
  procedures = withdrawal.totalProcedimentos;
  documents = withdrawal.totalDocumentos;

  if (procedures === 0) {
    return failure("Mantenha ao menos um procedimento para gerar o PDF.", 422);
  }

  // O preço enviado pelo navegador é ignorado: base, adicional e total saem daqui.
  const formato = record.formato as PlannerFormat;
  const preco = calculatePlannerPrice(documents, formato);

  try {
    const pdf = await renderPlannerPdf({
      cliente: payload.cliente,
      municipio: payload.municipio,
      uf: payload.uf,
      emitidoEm: new Date(),
      incluidos: withdrawal.incluidos,
      retirados: withdrawal.retirados,
      documentos: withdrawal.documentos,
      preco,
      comparativo: PLANNER_FORMATS.map((opcao) => calculatePlannerPrice(documents, opcao)),
      prazo: { diasUteis: 15, sujeitoConfirmacaoTecnica: documents > 100 },
      alertas: payload.plano.alertas,
    });

    finish(200);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "X-Request-Id": requestId,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName(payload.cliente)}"`,
      },
    });
  } catch {
    return failure("A geração do PDF está temporariamente indisponível.", 503);
  }
}
