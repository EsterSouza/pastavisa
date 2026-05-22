import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storageDriver } from "@/lib/file-storage";
import { getReadinessSummary } from "@/lib/env-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const readiness = getReadinessSummary();
  let databaseOk = false;
  let pastaCount: number | null = null;

  try {
    pastaCount = await prisma.pasta.count();
    databaseOk = true;
  } catch {
    databaseOk = false;
  }

  return NextResponse.json(
    {
      ok: readiness.ok && databaseOk,
      databaseOk,
      storageDriver: storageDriver(),
      pastaCount,
      readiness: readiness.checks,
    },
    { status: readiness.ok && databaseOk ? 200 : 503 }
  );
}
