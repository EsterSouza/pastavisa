import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteGeneratedDocx, saveStorageBuffer, safeStorageFileName } from "@/lib/file-storage";
import { requireAdmin } from "@/lib/auth/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const docs = await prisma.documentoUpload.findMany({
    where: { pastaId: params.id },
    include: { versoes: { orderBy: { criadaEm: "desc" } } },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const files = formData.getAll("arquivos") as File[];
      if (files.length === 0) {
        return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
      }

      const created = await Promise.all(
        files.map(async (file) => {
          const fileName = safeStorageFileName(`${params.id}_${Date.now()}_${Math.round(Math.random() * 1e6)}_${file.name}`);
          const uploadPath = await saveStorageBuffer(
            "uploads",
            fileName,
            Buffer.from(await file.arrayBuffer()),
            file.type || undefined
          );
          return prisma.documentoUpload.create({
            data: { pastaId: params.id, nomeArquivo: file.name, uploadPath, status: "pendente" },
          });
        })
      );
      return NextResponse.json(created, { status: 201 });
    }

    const body = await req.json();
    const arquivos: Array<{ nomeArquivo?: string; uploadPath?: string }> = Array.isArray(body.arquivos)
      ? body.arquivos
      : [];
    if (arquivos.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo informado" }, { status: 400 });
    }
    if (arquivos.some((a) => !a.nomeArquivo || !a.uploadPath)) {
      return NextResponse.json({ error: "nomeArquivo e uploadPath sao obrigatorios" }, { status: 400 });
    }

    const created = await Promise.all(
      arquivos.map((arquivo) =>
        prisma.documentoUpload.create({
          data: {
            pastaId: params.id,
            nomeArquivo: arquivo.nomeArquivo!,
            uploadPath: arquivo.uploadPath!,
            status: "pendente",
          },
        })
      )
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authorization = await requireAdmin();
  if (authorization) return authorization;

  try {
    const body = (await req.json()) as { id?: unknown; ids?: unknown };
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [body.id];
    const ids: string[] = Array.from(
      new Set<string>(
        rawIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um documento" }, { status: 400 });
    }
    if (ids.length > 100) {
      return NextResponse.json({ error: "Remova no maximo 100 documentos por vez" }, { status: 400 });
    }

    const docs = await prisma.documentoUpload.findMany({
      where: { id: { in: ids }, pastaId: params.id },
      select: { id: true, outputPath: true, versoes: { select: { outputPath: true } } },
    });
    if (docs.length !== ids.length) {
      return NextResponse.json(
        { error: "Um ou mais documentos nao pertencem a esta pasta. Atualize a lista e tente novamente." },
        { status: 404 }
      );
    }

    // uploadPath lives under "uploads", not "output", so it's intentionally left
    // alone here (deleteGeneratedDocx only allows removing files under storage/output).
    const outputPaths = new Set(
      docs.flatMap((doc) => [
        ...(doc.outputPath ? [doc.outputPath] : []),
        ...doc.versoes.map((versao) => versao.outputPath),
      ])
    );
    await Promise.all(Array.from(outputPaths).map((outputPath) => deleteGeneratedDocx(outputPath)));
    const removed = await prisma.documentoUpload.deleteMany({
      where: { id: { in: ids }, pastaId: params.id },
    });
    return NextResponse.json({ ok: true, removidos: removed.count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover documento" },
      { status: 500 }
    );
  }
}
