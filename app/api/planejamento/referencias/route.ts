import { NextRequest, NextResponse } from "next/server";
import { normalizeStateName, toUF, UF_OPTIONS } from "@visa/legislacao";
import { escolherReferencias } from "@/lib/planejamento/ia";
import { candidatasDoBanco, referenciaDoBanco } from "@/lib/planejamento/referencias";
import type { GrupoReferencias } from "@/lib/planejamento/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Escolhe a legislação do planejamento no banco VISA Legislação (só atos conferidos). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const uf = toUF(typeof body?.uf === "string" ? body.uf : "");
    const municipio = typeof body?.municipio === "string" ? body.municipio.trim() : "";
    const perfil = typeof body?.perfil === "string" ? body.perfil : "";
    if (!uf || !perfil) return NextResponse.json({ error: "Faltam UF e dados da cliente." }, { status: 400 });

    const estado = UF_OPTIONS.find((o) => o.uf === uf)?.name || normalizeStateName(uf);
    const { mapa, lista } = candidatasDoBanco(uf, municipio);
    const { escolha, tokens } = await escolherReferencias({ perfil, estado, municipio, candidatas: lista });

    const usados = new Set<string>();
    const grupos: GrupoReferencias[] = [];
    for (const grupo of escolha.grupos || []) {
      const itens = (grupo.ids || [])
        .filter((id) => mapa.has(id) && !usados.has(id))
        .map((id) => {
          usados.add(id);
          return referenciaDoBanco(mapa.get(id)!);
        });
      if (itens.length) grupos.push({ titulo: grupo.titulo.trim(), itens });
    }
    return NextResponse.json({ grupos, pendencias: escolha.pendencias || [], tokens, candidatas: lista.length });
  } catch (error) {
    console.error("[planejamento] referências falharam:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não deu para escolher as referências." },
      { status: 500 }
    );
  }
}
