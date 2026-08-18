import type { Legislacao, ReferenciaImportada } from "@/components/legislacoes/constants";

export async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let data: { error?: string } | T = {} as T;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { error?: string } | T;
    } catch {
      throw new Error(fallback);
    }
  }
  if (!response.ok) {
    throw new Error(("error" in (data as { error?: string }) && (data as { error?: string }).error) || fallback);
  }
  return data as T;
}

export function listarLegislacoes(): Promise<Legislacao[]> {
  return fetch("/api/legislacoes").then((res) => readJsonResponse<Legislacao[]>(res, "Erro ao carregar legislações."));
}

export function criarLegislacao(payload: object): Promise<Legislacao> {
  return fetch("/api/legislacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => readJsonResponse<Legislacao>(res, "Erro ao salvar referência."));
}

export function atualizarLegislacao(id: string, payload: Record<string, unknown>): Promise<Legislacao> {
  return fetch(`/api/legislacoes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => readJsonResponse<Legislacao>(res, "Erro ao atualizar referência."));
}

export function excluirLegislacao(id: string): Promise<void> {
  return fetch(`/api/legislacoes/${id}`, { method: "DELETE" }).then(() => undefined);
}

export function importarArquivoLegislacoes(
  arquivo: File,
  estadoUf: string,
  municipio: string
): Promise<{ referencias: ReferenciaImportada[]; textoExtraidoPreview: string | null }> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  formData.append("estadoUf", estadoUf);
  formData.append("municipio", municipio.trim());
  return fetch("/api/legislacoes/importar", { method: "POST", body: formData }).then((res) =>
    readJsonResponse<{ referencias: ReferenciaImportada[]; textoExtraidoPreview: string | null }>(res, "Erro ao analisar arquivo.")
  );
}
