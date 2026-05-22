import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({
    total: 0,
    results: [],
    message:
      "A importacao em massa pelo navegador foi desativada para evitar nomes quebrados. Para atualizar templates, rode npm run sync:templates no ambiente local, onde os DOCX originais existem.",
  });
}
