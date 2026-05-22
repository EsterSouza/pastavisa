import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer, storageFileExists } from "@/lib/file-storage";
import { createOutputDocxFileName } from "@/lib/generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Optional ?ids=id1,id2,id3 — if provided, only zip those specific documents.
  // If omitted, zip all generated documents in the pasta (backward-compatible).
  const idsParam = req.nextUrl.searchParams.get("ids");
  const filterIds = idsParam
    ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const docs = await prisma.documentoGerado.findMany({
    where: {
      pastaId: params.id,
      status: "gerado",
      ...(filterIds && filterIds.length > 0 ? { id: { in: filterIds } } : {}),
    },
  });

  if (docs.length === 0) {
    return NextResponse.json({ error: "Nenhum documento gerado" }, { status: 404 });
  }

  const pasta = await prisma.pasta.findUnique({ where: { id: params.id } });
  const nomeCliente = pasta?.clienteNomeFantasia?.replace(/[^a-zA-Z0-9\s]/g, "").trim() || params.id;

  const chunks: Buffer[] = [];

  const archive = archiver("zip", { zlib: { level: 6 } });
  const archiveDone = new Promise<void>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  const usedZipNames = new Set<string>();

  for (const doc of docs) {
    if (await storageFileExists(doc.outputPath)) {
      const buffer = await readStorageBuffer(doc.outputPath);
      const prettyName = createOutputDocxFileName(doc.nomeArquivo, usedZipNames);
      usedZipNames.add(prettyName.toLocaleUpperCase("pt-BR"));
      archive.append(buffer, { name: prettyName });
    }
  }

  archive.finalize();
  await archiveDone;

  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Pasta_${nomeCliente}.zip"`,
    },
  });
}
