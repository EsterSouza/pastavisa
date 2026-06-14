import {
  extrairReferenciasDoDocumento,
  type ReferenceScopeOptions,
} from "@/lib/reference-extractor";
import {
  encontrarReferenciaDuplicada,
  type ReferenciaComparavel,
} from "@/lib/reference-deduplication";

export interface LegislacaoAssociavel {
  id: string;
  estadoUf: string;
  municipio?: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt?: string | null;
  link?: string | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "o")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isInRequestedScope(legislacao: LegislacaoAssociavel, options: ReferenceScopeOptions): boolean {
  const estadoCliente = options.estadoUf?.toUpperCase().trim();
  const municipioCliente = normalize(options.municipio || "");
  const estadoLegislacao = legislacao.estadoUf?.toUpperCase().trim();

  if (!estadoLegislacao || estadoLegislacao === "BR") return true;
  if (estadoCliente && estadoLegislacao !== estadoCliente) return false;
  if (!estadoCliente) return false;

  if (legislacao.municipio) {
    if (!municipioCliente) return false;
    return normalize(legislacao.municipio) === municipioCliente;
  }

  return true;
}

export function associarLegislacoesDoDocumento(
  documentText: string,
  legislacoes: LegislacaoAssociavel[],
  options: ReferenceScopeOptions = {}
): LegislacaoAssociavel[] {
  const referenciasDoDocumento = extrairReferenciasDoDocumento(documentText, options);
  if (referenciasDoDocumento.length === 0) return [];

  const associadas = new Map<string, LegislacaoAssociavel>();

  referenciasDoDocumento.forEach((referencia) => {
    const dentroDoEscopo = legislacoes.filter((legislacao) =>
      isInRequestedScope(legislacao, options)
    );
    const match = encontrarReferenciaDuplicada(
      referencia,
      dentroDoEscopo as ReferenciaComparavel[]
    ) as LegislacaoAssociavel | undefined;

    if (match) associadas.set(match.id, match);
  });

  return Array.from(associadas.values());
}
