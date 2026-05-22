import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pastas = await prisma.pasta.findMany({
    orderBy: { criadaEm: "desc" },
    include: {
      documentos: {
        select: { id: true, status: true },
      },
    },
  });
  return NextResponse.json(pastas);
}
