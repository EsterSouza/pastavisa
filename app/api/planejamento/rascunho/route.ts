import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isManagedStorageReference, readStorageBuffer, storageDriver } from "@/lib/file-storage";
import { blocosDosAnexos, type Anexo } from "@/lib/planejamento/anexos";
import { lerFormulario, type TemplateCatalogo } from "@/lib/planejamento/ia";
import { montarPlanejamento, type OpcoesPlanejamento } from "@/lib/planejamento/montar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function opcoesDe(bruto: Record<string, unknown>): OpcoesPlanejamento | null {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const dataPlanejamento = texto(bruto.dataPlanejamento);
  if (!ISO.test(dataPlanejamento)) return null;
  return {
    dataPlanejamento,
    versaoPasta: texto(bruto.versaoPasta),
    plataforma: texto(bruto.plataforma),
    corLogo: texto(bruto.corLogo),
  };
}

/**
 * Lê o que a cliente mandou (formulário, outros PDFs, fotos, Word) com a IA e
 * devolve o rascunho do planejamento. Nada é gravado no banco.
 */
export async function POST(req: NextRequest) {
  try {
    const anexos: Anexo[] = [];
    let bruto: Record<string, unknown>;

    if (req.headers.get("content-type")?.includes("application/json")) {
      bruto = await req.json();
      const lista = Array.isArray(bruto.arquivos) ? (bruto.arquivos as Array<{ ref?: unknown; nome?: unknown }>) : [];
      if (storageDriver() !== "supabase") {
        return NextResponse.json({ error: "Envio direto indisponível neste servidor." }, { status: 400 });
      }
      for (const item of lista) {
        const ref = typeof item.ref === "string" ? item.ref : "";
        if (!isManagedStorageReference(ref, "uploads")) {
          return NextResponse.json({ error: "Referência de arquivo inválida." }, { status: 400 });
        }
        anexos.push({ nome: typeof item.nome === "string" ? item.nome : ref, conteudo: await readStorageBuffer(ref) });
      }
    } else {
      const form = await req.formData();
      for (const valor of form.getAll("arquivos")) {
        if (typeof valor === "string") continue;
        anexos.push({ nome: valor.name, conteudo: Buffer.from(await valor.arrayBuffer()) });
      }
      bruto = Object.fromEntries(Array.from(form.entries()).filter(([, v]) => typeof v === "string"));
    }

    const observacoes = typeof bruto.observacoes === "string" ? bruto.observacoes : "";
    if (anexos.length === 0 && !observacoes.trim()) {
      return NextResponse.json({ error: "Anexe o formulário ou cole as informações da cliente." }, { status: 400 });
    }
    const opcoes = opcoesDe(bruto);
    if (!opcoes) return NextResponse.json({ error: "Data do planejamento inválida." }, { status: 400 });

    const { blocos, ignorados } = await blocosDosAnexos(anexos);

    const doBanco = await prisma.template.findMany({
      where: { ativo: true },
      select: { nome: true, tipo: true },
      orderBy: { nome: "asc" },
    });
    const templates: TemplateCatalogo[] = doBanco.map((t, i) => ({
      id: `T${String(i + 1).padStart(3, "0")}`,
      nome: t.nome,
      tipo: t.tipo,
    }));

    const { rascunho, tokens } = await lerFormulario({ anexos: blocos, templates, observacoes });
    const resultado = montarPlanejamento(rascunho, opcoes, templates);
    for (const nome of ignorados) {
      resultado.pendencias.unshift({
        assunto: nome,
        detalhe: "Este arquivo não foi lido (formato não aceito ou com defeito). Abra e cole o conteúdo no campo de texto.",
        para: "ester",
      });
    }
    return NextResponse.json({ ...resultado, cidade: rascunho.cidade, uf: rascunho.uf, tokens });
  } catch (error) {
    console.error("[planejamento] rascunho falhou:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não deu para ler o formulário." },
      { status: 500 }
    );
  }
}
