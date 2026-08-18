/**
 * Comparação tolerante para busca e filtro na interface: sem acento, sem caixa.
 * O operador digita "clinica" e encontra "Clínica".
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
