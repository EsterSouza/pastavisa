import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countAiAdaptBlocks } from "@/lib/ai-adapt-blocks";
import { readStorageBuffer } from "@/lib/file-storage";
import { resolveProjectPath } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * A template with zero [AI_ADAPT_START] blocks never calls the AI model
 * regardless of its label (see lib/generator.ts) — this scans every existing
 * template and downgrades those wrongly labeled as needing IA (LIGHT/HEAVY/
 * SONNET) to HEADER_ONLY when they have no AI_ADAPT block at all, so the
 * cost/effort badge shown to the user matches what's actually spent.
 *
 * Only ever downgrades this one unambiguous case. Templates that do contain
 * AI_ADAPT blocks are left untouched — judging whether their content needs
 * Sonnet vs Haiku requires reading the instructions, which risks the
 * document quality this app is built to protect.
 */
export async function POST() {
  const templates = await prisma.template.findMany();
  const corrigidos: string[] = [];
  const semAcesso: string[] = [];

  for (const template of templates) {
    if (template.processingType === "HEADER_ONLY") continue;
    try {
      const buffer = await readStorageBuffer(resolveProjectPath(template.arquivoPath));
      const blockCount = countAiAdaptBlocks(buffer);
      if (blockCount === 0) {
        await prisma.template.update({
          where: { id: template.id },
          data: { processingType: "HEADER_ONLY" },
        });
        corrigidos.push(template.nome);
      }
    } catch {
      semAcesso.push(template.nome);
    }
  }

  return NextResponse.json({
    verificados: templates.length,
    corrigidos,
    semAcesso,
  });
}
