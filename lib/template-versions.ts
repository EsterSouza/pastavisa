import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface TemplateVersionSnapshot {
  id: string;
  templateId: string;
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  arquivoPath: string;
  motivo: string | null;
  criadaEm: Date | string;
}

export class TemplateVersionUnavailableError extends Error {
  constructor() {
    super("Histórico de versões ainda não está disponível. Aplique a migration de versões no banco e tente novamente.");
    this.name = "TemplateVersionUnavailableError";
  }
}

function isMissingVersionTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /TemplateVersao|templateversao|does not exist|no such table|relation .* does not exist/i.test(message);
}

export async function snapshotTemplateVersion(templateId: string, motivo: string) {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return null;

  try {
    await prisma.$executeRaw`
      INSERT INTO "TemplateVersao" (
        "id",
        "templateId",
        "nome",
        "tipo",
        "padraoHeader",
        "processingType",
        "arquivoPath",
        "motivo",
        "criadaEm"
      ) VALUES (
        ${randomUUID()},
        ${template.id},
        ${template.nome},
        ${template.tipo},
        ${template.padraoHeader},
        ${template.processingType},
        ${template.arquivoPath},
        ${motivo},
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    if (isMissingVersionTableError(error)) {
      console.warn("[template-versions] Snapshot ignorado: tabela TemplateVersao ausente.");
      return template;
    }
    throw error;
  }

  return template;
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersionSnapshot[]> {
  try {
    return await prisma.$queryRaw<TemplateVersionSnapshot[]>`
      SELECT
        "id",
        "templateId",
        "nome",
        "tipo",
        "padraoHeader",
        "processingType",
        "arquivoPath",
        "motivo",
        "criadaEm"
      FROM "TemplateVersao"
      WHERE "templateId" = ${templateId}
      ORDER BY "criadaEm" DESC
    `;
  } catch (error) {
    if (isMissingVersionTableError(error)) throw new TemplateVersionUnavailableError();
    throw error;
  }
}

export async function getTemplateVersion(
  templateId: string,
  versionId: string
): Promise<TemplateVersionSnapshot | null> {
  try {
    const versions = await prisma.$queryRaw<TemplateVersionSnapshot[]>`
      SELECT
        "id",
        "templateId",
        "nome",
        "tipo",
        "padraoHeader",
        "processingType",
        "arquivoPath",
        "motivo",
        "criadaEm"
      FROM "TemplateVersao"
      WHERE "templateId" = ${templateId} AND "id" = ${versionId}
      LIMIT 1
    `;
    return versions[0] || null;
  } catch (error) {
    if (isMissingVersionTableError(error)) throw new TemplateVersionUnavailableError();
    throw error;
  }
}
