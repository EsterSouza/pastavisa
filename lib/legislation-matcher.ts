import { matchesScope } from "@visa/legislacao";
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

/**
 * A norma alcança o território do cliente?
 *
 * A regra mora em @visa/legislacao para que o PastaVISA e o InspecVISA não
 * divirjam sobre o que vale onde: federal vale sempre, estadual exige a UF,
 * municipal exige UF e município. Aqui só se traduz "BR" — que é como esta
 * tabela grava abrangência nacional — para a uf nula que o pacote espera.
 */
function isInRequestedScope(
  legislacao: LegislacaoAssociavel,
  options: ReferenceScopeOptions
): boolean {
  return matchesScope(
    {
      name: legislacao.titulo,
      summary: "",
      url: "",
      authority: "",
      uf: legislacao.estadoUf === "BR" ? null : legislacao.estadoUf,
      municipio: legislacao.municipio,
      status: "nao_verificado",
    },
    { uf: options.estadoUf, municipio: options.municipio }
  );
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
