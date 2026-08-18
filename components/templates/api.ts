import type { BulkImportResult, Template, TemplateValidationReport, TemplateVersion } from "@/components/templates/constants";

export async function readJsonResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let data: { error?: string } | T = {} as T;

  if (text.trim()) {
    try {
      data = JSON.parse(text) as { error?: string } | T;
    } catch {
      throw new Error(`${fallback}. O servidor retornou uma resposta inesperada.`);
    }
  }

  if (!res.ok) {
    throw new Error(("error" in (data as { error?: string }) && (data as { error?: string }).error) || fallback);
  }

  return data as T;
}

export function listarTemplates(): Promise<Template[]> {
  return fetch("/api/templates").then((res) => readJsonResponse<Template[]>(res, "Erro ao carregar templates"));
}

export function enviarTemplate(form: {
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  arquivo: File;
}): Promise<Template> {
  const fd = new FormData();
  fd.append("arquivo", form.arquivo);
  fd.append("nome", form.nome);
  fd.append("tipo", form.tipo);
  fd.append("padraoHeader", form.padraoHeader);
  fd.append("processingType", form.processingType);
  return fetch("/api/templates", { method: "POST", body: fd }).then((res) =>
    readJsonResponse<Template>(res, "Erro no upload")
  );
}

export function importarTemplateEmLote(arquivo: File): Promise<{ results?: BulkImportResult[] }> {
  const fd = new FormData();
  fd.append("arquivos", arquivo);
  return fetch("/api/templates/bulk-import", { method: "POST", body: fd }).then((res) =>
    readJsonResponse<{ results?: BulkImportResult[] }>(res, `Erro ao importar ${arquivo.name}.`)
  );
}

export function atualizarTemplate(id: string, patch: Record<string, unknown>): Promise<Template> {
  return fetch(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((res) => readJsonResponse<Template>(res, "Erro ao salvar template."));
}

export function excluirTemplate(id: string): Promise<void> {
  return fetch(`/api/templates/${id}`, { method: "DELETE" }).then(() => undefined);
}

export function duplicarTemplate(id: string): Promise<Template> {
  return fetch(`/api/templates/${id}/duplicar`, { method: "POST" }).then((res) =>
    readJsonResponse<Template>(res, "Erro ao duplicar template.")
  );
}

export function recalcularTipoIa(): Promise<{ verificados: number; corrigidos: string[]; semAcesso: string[] }> {
  return fetch("/api/templates/recalcular-tipo", { method: "POST" }).then((res) =>
    readJsonResponse<{ verificados: number; corrigidos: string[]; semAcesso: string[] }>(
      res,
      "Erro ao recalcular tipo de IA"
    )
  );
}

export function buscarVariaveis(id: string): Promise<TemplateValidationReport> {
  return fetch(`/api/templates/${id}/variaveis`).then((res) =>
    readJsonResponse<TemplateValidationReport>(res, "Erro ao analisar template.")
  );
}

export function buscarPreview(id: string): Promise<{ html?: string }> {
  return fetch(`/api/templates/${id}/preview`).then((res) =>
    readJsonResponse<{ html?: string }>(res, "Erro ao carregar preview.")
  );
}

export function buscarVersoes(id: string): Promise<TemplateVersion[]> {
  return fetch(`/api/templates/${id}/versoes`).then((res) =>
    readJsonResponse<TemplateVersion[]>(res, "Erro ao carregar versões.")
  );
}

export function restaurarVersao(templateId: string, versaoId: string): Promise<Template> {
  return fetch(`/api/templates/${templateId}/versoes/${versaoId}/restaurar`, { method: "POST" }).then((res) =>
    readJsonResponse<Template>(res, "Erro ao restaurar versão.")
  );
}
