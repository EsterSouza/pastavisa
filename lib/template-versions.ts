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

export async function snapshotTemplateVersion(templateId: string, motivo: string) {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) return null;

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

  return template;
}

export async function listTemplateVersions(templateId: string): Promise<TemplateVersionSnapshot[]> {
  return prisma.$queryRaw<TemplateVersionSnapshot[]>`
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
}

export async function getTemplateVersion(
  templateId: string,
  versionId: string
): Promise<TemplateVersionSnapshot | null> {
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
}
