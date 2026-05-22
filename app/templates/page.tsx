"use client";

import { useEffect, useState } from "react";

interface Template {
  id: string;
  nome: string;
  tipo: string;
  padraoHeader: string;
  processingType: string;
  ativo: boolean;
  criadoEm: string;
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
  const sonnet = ["INTERCORRENCIAS EMERGENCIAS","INTERCORRENCIAS E EMERGENCIAS","IMPLEMENTACAO DO PROCESSO"];
  if (sonnet.some((k) => n.includes(k))) return "SONNET_REQUIRED";
  const heavy = ["MANUAL DE BOAS PRATICAS","MBP","RELACAO DE EQUIPAMENTOS","RELACAO DE SERVICOS",
    "RELACAO SERVICOS","GUIA DE UTILIZACAO","GUIA UTILIZACAO","PSP","PLANO DE SEGURANCA"];
  if (heavy.some((k) => n.includes(k))) return "HEAVY_HAIKU";
  return "LIGHT_HAIKU";
}

function getPtBadge(pt: string) {
  return PROCESSING_TYPES.find((p) => p.value === pt) || PROCESSING_TYPES[1];
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "MBP", padraoHeader: "A", processingType: "LIGHT_HAIKU" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Edit modal
  const [editando, setEditando] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  // Variables modal
  const [variavelModal, setVariavelModal] = useState<{ nome: string; vars: string[] } | null>(null);
  const [loadingVars, setLoadingVars] = useState<string | null>(null);

  // Duplicate
  const [duplicando, setDuplicando] = useState<string | null>(null);

  // Search & filters
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPT, setFiltroPT] = useState("");

  async function load() {
    const res = await fetch("/api/templates");
    setTemplates(await res.json());
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
    const fd = new FormData();
    fd.append("arquivo", file);
    fd.append("nome", form.nome);
    fd.append("tipo", form.tipo);
    fd.append("padraoHeader", form.padraoHeader);
    fd.append("processingType", form.processingType);
    const res = await fetch("/api/templates", { method: "POST", body: fd });
    if (res.ok) {
      setForm({ nome: "", tipo: "MBP", padraoHeader: "A", processingType: "LIGHT_HAIKU" });
      setFile(null);
      await load();
    } else {
      const j = await res.json();
      setError(j.error || "Erro no upload");
    }
    setUploading(false);
  }

  async function handleBulkImport() {
    setImporting(true); setImportMsg("");
    const res = await fetch("/api/templates/bulk-import", { method: "POST" });
    const json = await res.json();
    const importados = json.results?.filter((r: { status: string }) => r.status === "importado").length || 0;
    const jaExistem = json.results?.filter((r: { status: string }) => r.status === "já existe").length || 0;
    setImportMsg(`✓ ${importados} templates importados, ${jaExistem} já existiam.`);
    await load();
    setImporting(false);
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
      body: JSON.stringify({ nome: editando.nome, tipo: editando.tipo, padraoHeader: editando.padraoHeader }),
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
    const res = await fetch(`/api/templates/${t.id}/variaveis`);
    const json = await res.json();
    setVariavelModal({ nome: t.nome, vars: json.variaveis || [] });
    setLoadingVars(null);
  }

  const templatesFiltrados = templates.filter((t) => {
    const q = busca.toLowerCase();
    const matchBusca = !q || t.nome.toLowerCase().includes(q) || t.tipo.toLowerCase().includes(q);
    const matchTipo = !filtroTipo || t.tipo === filtroTipo;
    const matchPT = !filtroPT || t.processingType === filtroPT;
    return matchBusca && matchTipo && matchPT;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <button
          onClick={handleBulkImport}
          disabled={importing}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {importing ? "Reindexando..." : "Reindexar templates do Storage"}
        </button>
      </div>

      {importMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4">
          {importMsg}
        </div>
      )}

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
                    onClick={() => handleVerVariaveis(t)}
                    disabled={loadingVars === t.id}
                    title="Ver variáveis do template"
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingVars === t.id ? "..." : "{x}"}
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
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Variáveis detectadas</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{variavelModal.nome}</p>
              </div>
              <button onClick={() => setVariavelModal(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {variavelModal.vars.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma variável <code className="bg-gray-100 px-1 rounded">{"{}"}</code> encontrada no arquivo.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {variavelModal.vars.map((v) => (
                  <code key={v} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded px-2 py-1">
                    {`{${v}}`}
                  </code>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Essas variáveis são substituídas automaticamente durante a geração do documento.
            </p>
            <div className="flex justify-end mt-4">
              <button onClick={() => setVariavelModal(null)}
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
