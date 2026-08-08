import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlannerCatalogItem } from "./types";

export async function loadActivePlannerCatalog(): Promise<PlannerCatalogItem[]> {
  const templates = await prisma.template.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, tipo: true },
    orderBy: { nome: "asc" },
  });
  return templates.map((template) => ({ id: template.id, name: template.nome, type: template.tipo }));
}
