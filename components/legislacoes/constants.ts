import type { Tone } from "@/components/ui/Status";

export interface Legislacao {
  id: string;
  estadoUf: string;
  municipio: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt: string | null;
  chaveReferencia?: string | null;
  ativo: boolean;
}

export interface ReferenciaImportada {
  estadoUf: string;
  municipio?: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt?: string | null;
  ativo: boolean;
}

export const ESTADOS_BR = [
  "BR", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export const TIPOS_FORM = [
  { value: "federal", label: "Federal" },
  { value: "federal_profissional", label: "Federal — Conselho profissional" },
  { value: "federal_tecnico", label: "Federal — Publicação técnica" },
  { value: "estadual", label: "Estadual" },
  { value: "estadual_tecnico", label: "Estadual — Nota técnica" },
  { value: "municipal", label: "Municipal" },
];

export function esferaDe(tipo: string): "federal" | "estadual" | "municipal" {
  if (tipo.startsWith("federal")) return "federal";
  if (tipo.startsWith("estadual")) return "estadual";
  return "municipal";
}

export function segmentoDe(titulo: string, referenciaAbnt: string): string {
  const t = (titulo + " " + referenciaAbnt).toLowerCase();
  if (/cofen|enfermagem|nr-32|nr-6|nr6|nrs/.test(t)) return "Enfermagem";
  if (/embelezamento|estética|cosmetol|pigmentação|beleza|cabeleireiro|esteticista|micropigmentação/.test(t)) return "Estética";
  if (/resíduos|pgrss|rss/.test(t)) return "Resíduos";
  if (/ilpi|idoso|longa permanência/.test(t)) return "ILPI";
  return "Transversal";
}

// Uma cor por esfera em vez de uma por subtipo: índigo, teal e laranja do painel
// antigo não existem em tailwind.config e saíam sem cor nenhuma.
export const ESFERA_TONE: Record<ReturnType<typeof esferaDe>, Tone> = {
  federal: "info",
  estadual: "sucesso",
  municipal: "atencao",
};

export const BLANK_FORM = {
  estadoUf: "RJ",
  municipio: "",
  tipo: "estadual",
  titulo: "",
  referenciaAbnt: "",
  destaqueAbnt: "",
};
