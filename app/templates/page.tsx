"use client";

import { useEffect, useState } from "react";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import {
  findTemplateVariable,
  TEMPLATE_SPECIAL_SYNTAX,
  TEMPLATE_VARIABLE_CATEGORIES,
  TEMPLATE_VARIABLES,
  TemplateVariableDefinition,
} from "@/lib/template-variables";

interface Template {
  id: string;
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  ativo: boolean;
  criadoEm: string;
}

interface TemplateValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
}

interface TemplateValidationReport {
  variaveis: string[];
  variaveisReconhecidas: string[];
  variaveisDesconhecidas: string[];
  condicionais: Array<{ key: string; valid: boolean }>;
  blocosIa: number;
  issues: TemplateValidationIssue[];
  valid: boolean;
}

interface TemplateVersion {
  id: string;
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  arquivoPath: string;
  motivo: string | null;
  criadaEm: string;
}

interface BulkImportResult {
  nome: string;
  status: string;
  tipo?: string;
  variaveis?: number;
  errosValidacao?: number;
  error?: string;
}

const TIPOS = ["MBP", "POP", "TCLE", "PGRSS", "FICHA", "PLANILHA", "GUIA", "TERMO", "RECEITUARIO", "OUTROS"];
const PADROES = ["A", "B", "C", "D"];
const PADROES_LABEL: Record<string, string> = {
  A: "Institucional", B: "POP", C: "TCLE/Ficha", D: "Consultora",
};
const PROCESSING_TYPES = [
  { value: "HEADER_ONLY", label: "Sem IA ($0)", color: "bg-gray-100 text-gray-700" },
  { value: "LIGHT_HAIKU", label: "IA leve (~$0,01)", color: "bg-blue-100 text-blue-700" },
  { value: "HEAVY_HAIKU", label: "IA moderada (~$0,05)", color: "bg-yellow-100 text-yellow-700" },
  { value: "SONNET_REQUIRED", label: "IA complexa (~$0,20)", color: "bg-purple-100 text-purple-700" },
];

function detectProcessingTypeClient(nome: string): string {
  const n = nome.toUpperCase().replace(/[_\-\.]/g, " ");
  const headerOnly = ["PLANILHA","CONTROLE DE ENTREGA","CONTROLE DE TEMPERATURA","CONTROLE DE LIMPEZA",
    "FICHA DE ANAMNESE","FICHA ANAMNESE","TERMO DE RENUNCIA","TERMO RENUNCIA","TERMO DE RECUSA","ENCAMINHAMENTO"];
  if (headerOnly.some((k) => n.includes(k))) return "HEADER_ONLY";
  const sonnet = [
    "INTERCORRENCIAS EMERGENCIAS",
    "INTERCORRENCIAS E EMERGENCIAS",
    "IMPLEMENTACAO DO PROCESSO",
    "PGRSS",
    "PLANO DE GERENCIAMENTO",
    "PCI",
    "PLANO DE CONTROLE DE INFECCAO",
    "PSP",
    "PLANO DE SEGURANCA",
    "MANUAL DE BOAS PRATICAS",
    "MBP",
    "RELACAO DE SERVICOS",
    "RELACAO SERVICOS",
    "POP",
    "PROCEDIMENTO OPERACIONAL PADRAO",
    "TCLE",
    "TERMO DE CONSENTIMENTO",
    "PROTOCOLO",
  ];
  if (sonnet.some((k) => n.includes(k))) return "SONNET_REQUIRED";
  const heavy = ["RELACAO DE EQUIPAMENTOS","GUIA DE UTILIZACAO","GUIA UTILIZACAO"];
  if (heavy.some((k) => n.includes(k))) return "HEAVY_HAIKU";
  return "LIGHT_HAIKU";
}

function getPtBadge(pt: string) {
  return PROCESSING_TYPES.find((p) => p.value === pt) || PROCESSING_TYPES[1];
}

async function readJsonResponse<T>(res: Response, fallback: string): Promise<T> {
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

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "MBP", padraoHeader: "A", processingType: "LIGHT_HAIKU" });
  const [file, setFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importResults, setImportResults] = useState<Array<{
    nome: string;
    status: string;
    tipo?: string;
    variaveis?: number;
    errosValidacao?: number;
    error?: string;
  }>>([]);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit modal
  const [editando, setEditando] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  // Variables and validation
  const [variavelModal, setVariavelModal] = useState<{ nome: string; report: TemplateValidationReport } | null>(null);
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);
  const [versionModal, setVersionModal] = useState<{ template: Template; versoes: TemplateVersion[] } | null>(null);
  const [loadingVars, setLoadingVars] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [loadingVersions, setLoadingVersions] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [copiedTag, setCopiedTag] = useState("");

  // Duplicate
  const [duplicando, setDuplicando] = useState<string | null>(null);

  // Search & filters
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPT, setFiltroPT] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/templates");
      setTemplates(await readJsonResponse<Template[]>(res, "Erro ao carregar templates"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar templates.");
    }
  }

  useEffect(() => { load(); }, []);

  function handleFileChange(f: File | null) {
    setFile(f);
    if (f && !form.nome) {
      const nomeLimpo = f.name.replace(/^TEMPLATE_/i, "").replace(/_/g, " ").replace(/\.docx$/i, "");
      const pt = detectProcessingTypeClient(f.name);
      setForm((prev) => ({ ...prev, nome: nomeLimpo, processingType: pt }));
    } else if (f) {
      const pt = detectProcessingTypeClient(f.name);
      setForm((prev) => ({ ...prev, processingType: pt }));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !form.nome) { setError("Nome e arquivo são obrigatórios."); return; }
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      fd.append("nome", form.nome);
      fd.append("tipo", form.tipo);
      fd.append("padraoHeader", form.padraoHeader);
      fd.append("processingType", form.processingType);
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      await readJsonResponse<Template>(res, "Erro no upload");
      setForm({ nome: "", tipo: "MBP", padraoHeader: "A", processingType: "LIGHT_HAIKU" });
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleBulkImport() {
    if (bulkFiles.length === 0) {
      setImportMsg("Selecione um ou mais arquivos .docx para importar.");
      return;
    }
    setImporting(true); setImportMsg(""); setImportResults([]);
    try {
      const results: BulkImportResult[] = [];

      for (let index = 0; index < bulkFiles.length; index += 1) {
        const selectedFile = bulkFiles[index];
        setImportMsg(`Importando ${index + 1}/${bulkFiles.length}: ${selectedFile.name}`);

        try {
          const fd = new FormData();
          fd.append("arquivos", selectedFile);
          const res = await fetch("/api/templates/bulk-import", { method: "POST", body: fd });
          const json = await readJsonResponse<{ results?: BulkImportResult[] }>(
            res,
            `Erro ao importar ${selectedFile.name}.`
          );
          results.push(...(json.results || []));
        } catch (err) {
          results.push({
            nome: selectedFile.name.replace(/\.docx$/i, ""),
            status: "erro",
            error: err instanceof Error ? err.message : "Erro ao importar template.",
          });
        }

        setImportResults([...results]);
      }

      const importados = results.filter((r) => r.status === "importado").length;
      const atualizados = results.filter((r) => r.status === "atualizado").length;
      const erros = results.filter((r) => r.status === "erro").length;
      setImportMsg(`Importação concluída: ${importados} novo(s), ${atualizados} atualizado(s), ${erros} com erro.`);
      setBulkFiles([]);
      await load();
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Erro ao importar templates.");
    } finally {
      setImporting(false);
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !ativo }),
    });
    await load();
  }

  async function updateProcessingType(id: string, processingType: string) {
    await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processingType }),
    });
    await load();
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSaving(true);
    await fetch(`/api/templates/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: editando.nome,
        tipo: editando.tipo,
        padraoHeader: editando.padraoHeader,
        processingType: editando.processingType,
      }),
    });
    setEditando(null);
    setSaving(false);
    await load();
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir template "${nome}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleDuplicate(id: string) {
    setDuplicando(id);
    await fetch(`/api/templates/${id}/duplicar`, { method: "POST" });
    await load();
    setDuplicando(null);
  }

  // ── Multi-select helpers ────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    // Selects only the currently visible (filtered) templates
    setSelected(new Set(templatesFiltrados.map((t) => t.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} template${selected.size > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`)) return;
    setBulkDeleting(true);
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/templates/${id}`, { method: "DELETE" })));
    setSelected(new Set());
    await load();
    setBulkDeleting(false);
  }

  async function handleBulkToggleAtivo(ativar: boolean) {
    if (selected.size === 0) return;
    await Promise.all(
      Array.from(selected).map((id) =>
        fetch(`/api/templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ativo: ativar }),
        })
      )
    );
    setSelected(new Set());
    await load();
  }

  async function handleVerVariaveis(t: Template) {
    setLoadingVars(t.id);
    setError("");
    try {
      const res = await fetch(`/api/templates/${t.id}/variaveis`);
      const json = await readJsonResponse<TemplateValidationReport>(res, "Erro ao analisar template.");
      setVariavelModal({ nome: t.nome, report: json });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar template.");
    } finally {
      setLoadingVars(null);
    }
  }

  async function handleVisualizarTemplate(t: Template) {
    setLoadingPreview(t.id);
    setPreview({ title: t.nome, html: "", loading: true });
    try {
      const res = await fetch(`/api/templates/${t.id}/preview`);
      const json = await readJsonResponse<{ html?: string }>(res, "Erro ao carregar preview.");
      setPreview({ title: t.nome, html: json.html || "", loading: false });
    } catch (err) {
      setPreview({
        title: t.nome,
        html: "",
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao carregar preview.",
      });
    } finally {
      setLoadingPreview(null);
    }
  }

  async function handleVerVersoes(t: Template) {
    setLoadingVersions(t.id);
    setError("");
    try {
      const res = await fetch(`/api/templates/${t.id}/versoes`);
      const json = await readJsonResponse<TemplateVersion[]>(res, "Erro ao carregar versões.");
      setVersionModal({ template: t, versoes: json });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar versões.");
    } finally {
      setLoadingVersions(null);
    }
  }

  async function handleRestaurarVersao(templateId: string, versaoId: string) {
    if (!confirm("Restaurar esta versão? A versão atual será guardada no histórico antes da restauração.")) return;
    setRestoringVersion(versaoId);
    try {
      const res = await fetch(`/api/templates/${templateId}/versoes/${versaoId}/restaurar`, { method: "POST" });
      await readJsonResponse<Template>(res, "Erro ao restaurar versão.");
      await load();
      setVersionModal(null);
      setImportMsg("Versão anterior restaurada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao restaurar versão.");
    } finally {
      setRestoringVersion(null);
    }
  }

  async function copyTag(tag: string) {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTag(tag);
      window.setTimeout(() => setCopiedTag(""), 1500);
    } catch {
      setCopiedTag("");
    }
  }

  const templatesFiltrados = templates.filter((t) => {
    const q = busca.toLowerCase();
    const matchBusca = !q || t.nome.toLowerCase().includes(q) || t.tipo.toLowerCase().includes(q);
    const matchTipo = !filtroTipo || t.tipo === filtroTipo;
    const matchPT = !filtroPT || t.processingType === filtroPT;
    return matchBusca && matchTipo && matchPT;
  });
  const catalogVariables = TEMPLATE_VARIABLES.filter((variable) => {
    const q = catalogSearch.trim().toLowerCase();
    const text = `${variable.key} ${variable.description} ${variable.use}`.toLowerCase();
    return (!q || text.includes(q)) && (!catalogCategory || variable.category === catalogCategory);
  });

  function variableCard(variable: TemplateVariableDefinition, used = false) {
    return (
      <div key={variable.key} className={`rounded-lg border p-3 ${used ? "border-green-200 bg-green-50/40" : "border-gray-200 bg-white"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <code className="text-xs font-semibold text-blue-800">{variable.tag}</code>
            {variable.legacy && <span className="ml-2 text-[10px] text-amber-700">legado</span>}
          </div>
          <button type="button" onClick={() => { void copyTag(variable.tag); }} className="text-xs text-blue-600 hover:underline shrink-0">
            {copiedTag === variable.tag ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1">{variable.description}</p>
        <p className="text-[11px] text-gray-500 mt-1">Exemplo: {variable.example || "(vazio até ser informado)"}</p>
        <p className="text-[11px] text-gray-400 mt-1">{variable.use}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
      </div>

      {importMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">
          {importMsg}
        </div>
      )}

      <section className="bg-white border border-green-200 rounded-xl p-5 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Importar ou atualizar templates em lote</h2>
            <p className="text-xs text-gray-500 mt-1">
              Selecione os DOCX novos ou substituídos. Se o nome já existir, o app atualiza o template ativo.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:min-w-[360px]">
            <input
              type="file"
              accept=".docx"
              multiple
              onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
              disabled={importing}
              className="block w-full text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => { void handleBulkImport(); }}
              disabled={importing || bulkFiles.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {importing
                ? "Importando..."
                : bulkFiles.length > 0
                ? `Importar/atualizar ${bulkFiles.length} template${bulkFiles.length > 1 ? "s" : ""}`
                : "Selecionar DOCX para importar"}
            </button>
          </div>
        </div>
        {bulkFiles.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Selecionados: {bulkFiles.map((selectedFile) => selectedFile.name).join(", ")}
          </p>
        )}
        {importResults.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
              <span>Template</span>
              <span>Status</span>
              <span>Validação</span>
            </div>
            {importResults.map((result, index) => (
              <div key={`${result.nome}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-gray-100 px-3 py-2 text-xs">
                <span className="truncate text-gray-800" title={result.nome}>{result.nome}</span>
                <span className={result.status === "erro" ? "text-red-700" : result.status === "atualizado" ? "text-blue-700" : "text-green-700"}>
                  {result.status}
                </span>
                <span className={result.status === "erro" || (result.errosValidacao || 0) > 0 ? "text-red-700" : "text-gray-500"}>
                  {result.status === "erro"
                    ? result.error
                    : `${result.variaveis ?? 0} variáveis, ${result.errosValidacao ?? 0} erro(s)`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upload form */}
      <form onSubmit={handleUpload} className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Adicionar template manualmente</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do template</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="ex: POP Micropigmentação Labial"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Padrão de cabeçalho</label>
            <select value={form.padraoHeader} onChange={(e) => setForm({ ...form, padraoHeader: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
              {PADROES.map((p) => (
                <option key={p} value={p}>{p} — {PADROES_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Processamento{" "}
              <span className="text-gray-400 font-normal">(detectado automaticamente)</span>
            </label>
            <select value={form.processingType} onChange={(e) => setForm({ ...form, processingType: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
              {PROCESSING_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Arquivo .docx</label>
            <input type="file" accept=".docx"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button type="submit" disabled={uploading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {uploading ? "Enviando..." : "Adicionar template"}
        </button>
      </form>

      <section className="bg-white border border-gray-200 rounded-xl mb-6">
        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800">Biblioteca de variáveis</h2>
            <p className="text-xs text-gray-500 mt-1">
              Tags disponíveis para qualquer template. Copie e cole no DOCX onde o preenchimento deve aparecer.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCatalogOpen((open) => !open)}
            className="text-sm text-blue-600 hover:underline shrink-0"
          >
            {catalogOpen ? "Ocultar" : "Abrir biblioteca"}
          </button>
        </div>
        {catalogOpen && (
          <div className="border-t border-gray-100 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar variável ou finalidade..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <select
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="">Todas as categorias</option>
                {TEMPLATE_VARIABLE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {catalogVariables.map((variable) => variableCard(variable))}
            </div>
            {catalogVariables.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma variável encontrada com estes filtros.</p>
            )}
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
              <h3 className="text-sm font-semibold text-violet-900 mb-3">Recursos de preenchimento avançado</h3>
              <div className="space-y-3">
                {TEMPLATE_SPECIAL_SYNTAX.map((syntax) => (
                  <div key={syntax.label}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-violet-800">{syntax.label}</span>
                      <code className="text-xs bg-white border border-violet-200 rounded px-2 py-1 text-violet-900">{syntax.syntax}</code>
                      <button type="button" onClick={() => { void copyTag(syntax.syntax); }} className="text-xs text-blue-600 hover:underline">
                        {copiedTag === syntax.syntax ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{syntax.description}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Exemplo: {syntax.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Templates list */}
      <div className="bg-white border border-gray-200 rounded-xl">

        {/* Header — normal or bulk-action mode */}
        {selected.size === 0 ? (
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">
                Templates cadastrados{" "}
                <span className="font-normal text-gray-500">
                  ({templatesFiltrados.length}{templatesFiltrados.length !== templates.length ? ` de ${templates.length}` : ""})
                </span>
              </h2>
              {templates.length > 0 && (
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                  Selecionar todos
                </button>
              )}
            </div>
            {/* Search & filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar template..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-300 focus:outline-none text-gray-800"
                />
              </div>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:bg-white focus:border-blue-300 focus:outline-none"
              >
                <option value="">Todos os tipos</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filtroPT}
                onChange={(e) => setFiltroPT(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:bg-white focus:border-blue-300 focus:outline-none"
              >
                <option value="">Todos os processamentos</option>
                {PROCESSING_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {(busca || filtroTipo || filtroPT) && (
                <button
                  onClick={() => { setBusca(""); setFiltroTipo(""); setFiltroPT(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-5 py-3 border-b border-blue-100 bg-blue-50 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === templates.length}
                onChange={(e) => e.target.checked ? selectAll() : selectNone()}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm font-medium text-blue-800">
                {selected.size} selecionado{selected.size > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkToggleAtivo(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 bg-white hover:bg-green-50 font-medium"
              >
                Ativar todos
              </button>
              <button
                onClick={() => handleBulkToggleAtivo(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 font-medium"
              >
                Desativar todos
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 font-medium disabled:opacity-50"
              >
                {bulkDeleting ? "Excluindo..." : `Excluir ${selected.size}`}
              </button>
              <button
                onClick={selectNone}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <p className="px-5 py-6 text-gray-600 text-sm">
            Nenhum template cadastrado. Clique em &quot;Importar todos os templates&quot; para começar.
          </p>
        )}

        {templates.length > 0 && templatesFiltrados.length === 0 && (
          <p className="px-5 py-6 text-gray-500 text-sm text-center">
            Nenhum template encontrado com os filtros aplicados.
          </p>
        )}

        <ul className="divide-y divide-gray-100">
          {templatesFiltrados.map((t) => {
            const ptBadge = getPtBadge(t.processingType);
            const isSel = selected.has(t.id);
            return (
              <li
                key={t.id}
                className={`px-5 py-3 flex items-center gap-3 transition-colors ${
                  isSel ? "bg-blue-50/60" : ""
                } ${!t.ativo ? "opacity-50" : ""}`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggleOne(t.id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.nome}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.tipo} · Padrão {t.padraoHeader} ({PADROES_LABEL[t.padraoHeader]}) · {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                {/* processingType inline selector */}
                <select
                  value={t.processingType}
                  onChange={(e) => updateProcessingType(t.id, e.target.value)}
                  className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer ${ptBadge.color}`}
                >
                  {PROCESSING_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => { void handleVisualizarTemplate(t); }}
                    disabled={loadingPreview === t.id}
                    title="Visualizar DOCX do template"
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingPreview === t.id ? "..." : "Visualizar"}
                  </button>
                  <button
                    onClick={() => handleVerVariaveis(t)}
                    disabled={loadingVars === t.id}
                    title="Validar variáveis do template"
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingVars === t.id ? "..." : "Validar"}
                  </button>
                  <button
                    onClick={() => { void handleVerVersoes(t); }}
                    disabled={loadingVersions === t.id}
                    title="Ver e restaurar versões anteriores"
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingVersions === t.id ? "..." : "Versões"}
                  </button>
                  <button
                    onClick={() => setEditando({ ...t })}
                    title="Editar metadados"
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDuplicate(t.id)}
                    disabled={duplicando === t.id}
                    title="Duplicar template"
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {duplicando === t.id ? "..." : "Duplicar"}
                  </button>
                  <button
                    onClick={() => toggleAtivo(t.id, t.ativo)}
                    className={`text-xs px-3 py-1 rounded-full font-medium border shrink-0 ${t.ativo ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                  >
                    {t.ativo ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.nome)}
                    title="Excluir template"
                    className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Edit modal ─────────────────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleEditSave}
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Editar metadados</h2>
              <button type="button" onClick={() => setEditando(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
              <input type="text" value={editando.nome}
                onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={editando.tipo}
                  onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  {TIPOS.map((tp) => <option key={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Padrão de cabeçalho</label>
                <select value={editando.padraoHeader}
                  onChange={(e) => setEditando({ ...editando, padraoHeader: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  {PADROES.map((p) => <option key={p} value={p}>{p} — {PADROES_LABEL[p]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Instrução de geração</label>
              <select value={editando.processingType}
                onChange={(e) => setEditando({ ...editando, processingType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                {PROCESSING_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Isso controla se o template apenas substitui variáveis ou usa IA leve/moderada/avançada nos blocos [AI_ADAPT_START].
              </p>
            </div>
            <div className="grid gap-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-blue-900">Variáveis mais usadas</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "{cliente_nome_fantasia}",
                    "{cliente_logo}",
                    "{cliente_memorial_descritivo_mbp}",
                    "{cliente_servicos_lista}",
                    "{texto_legislacao_federal}",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { void copyTag(tag); }}
                      className="rounded border border-blue-200 bg-white px-2 py-1 text-[11px] text-blue-800 hover:bg-blue-50"
                    >
                      {copiedTag === tag ? "Copiado" : tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-900">Como usar instruções</p>
                <p className="mt-2 text-xs text-gray-600">
                  No DOCX, coloque dados fixos com {"{variavel}"} e trechos adaptáveis entre [AI_ADAPT_START] e [AI_ADAPT_END].
                  Use Validar depois de salvar para conferir tags quebradas.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setEditando(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Variables modal ─────────────────────────────────────────── */}
      {variavelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Diagnóstico do template</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{variavelModal.nome}</p>
              </div>
              <button onClick={() => setVariavelModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className={`rounded-lg border px-4 py-3 text-sm mb-4 ${
              variavelModal.report.valid
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {variavelModal.report.valid
                ? "Template válido: nenhuma tag desconhecida ou marcador quebrado foi detectado."
                : "Este template precisa de correção antes de ser usado com segurança."}
            </div>

            {variavelModal.report.issues.length > 0 && (
              <div className="space-y-2 mb-5">
                {variavelModal.report.issues.map((issue, index) => (
                  <p key={`${issue.level}-${index}`} className={`text-sm rounded-lg border px-3 py-2 ${
                    issue.level === "error"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : issue.level === "warning"
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-blue-50 border-blue-200 text-blue-700"
                  }`}>
                    {issue.message}
                  </p>
                ))}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Tags utilizadas ({variavelModal.report.variaveis.length})
                </h3>
                {variavelModal.report.variaveis.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma tag encontrada neste arquivo.</p>
                ) : (
                  <div className="space-y-2">
                    {variavelModal.report.variaveis.map((key) => {
                      const variable = findTemplateVariable(key);
                      return variable ? variableCard(variable, true) : (
                        <div key={key} className="rounded-lg border border-red-200 bg-red-50 p-3 flex justify-between gap-2">
                          <div>
                            <code className="text-xs font-semibold text-red-800">{`{${key}}`}</code>
                            <p className="text-xs text-red-700 mt-1">Esta tag não existe no preenchimento atual.</p>
                          </div>
                          <button type="button" onClick={() => { void copyTag(`{${key}}`); }} className="text-xs text-blue-600 hover:underline">
                            Copiar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Automações detectadas</h3>
                  <p className="text-xs text-gray-600">
                    Blocos de IA: <span className="font-medium">{variavelModal.report.blocosIa}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Condicionais: <span className="font-medium">{variavelModal.report.condicionais.length}</span>
                  </p>
                  {variavelModal.report.condicionais.map((condition) => (
                    <code key={condition.key} className={`block text-xs mt-2 rounded px-2 py-1 ${
                      condition.valid ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                    }`}>
                      {`{#${condition.key}}...{/${condition.key}}`}
                    </code>
                  ))}
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-700">Como adicionar outra variável</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Use a Biblioteca de variáveis acima para copiar a tag exata e inserir no DOCX. Depois reabra este diagnóstico para conferir.
                  </p>
                </div>
              </section>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setVariavelModal(null)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {versionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Versões do template</h2>
                <p className="text-xs text-gray-500 mt-0.5">{versionModal.template.nome}</p>
              </div>
              <button onClick={() => setVersionModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
            </div>
            {versionModal.versoes.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Ainda não há versões anteriores para este template. A partir de agora, edições e importações guardam histórico automaticamente.
              </p>
            ) : (
              <div className="space-y-2">
                {versionModal.versoes.map((versao) => (
                  <div key={versao.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{versao.nome}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {new Date(versao.criadaEm).toLocaleString("pt-BR")} · {versao.tipo} · {getPtBadge(versao.processingType).label}
                      </p>
                      {versao.motivo && (
                        <p className="mt-1 text-xs text-gray-400">{versao.motivo}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { void handleRestaurarVersao(versionModal.template.id, versao.id); }}
                      disabled={restoringVersion === versao.id}
                      className="shrink-0 rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {restoringVersion === versao.id ? "Restaurando..." : "Restaurar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
