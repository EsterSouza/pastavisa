"use client";

import { useEffect, useState } from "react";

interface Legislacao {
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

interface ReferenciaImportada {
  estadoUf: string;
  municipio?: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt?: string | null;
  ativo: boolean;
}

const ESTADOS_BR = [
  "BR","AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const TIPOS_FORM = [
  { value: "federal", label: "Federal" },
  { value: "federal_profissional", label: "Federal — Conselho profissional" },
  { value: "federal_tecnico", label: "Federal — Publicação técnica" },
  { value: "estadual", label: "Estadual" },
  { value: "estadual_tecnico", label: "Estadual — Nota técnica" },
  { value: "municipal", label: "Municipal" },
];

function esferaDe(tipo: string) {
  if (tipo.startsWith("federal")) return "federal";
  if (tipo.startsWith("estadual")) return "estadual";
  return "municipal";
}

function segmentoDe(titulo: string, referenciaAbnt: string): string {
  const t = (titulo + " " + referenciaAbnt).toLowerCase();
  if (/cofen|enfermagem|nr-32|nr-6|nr6|nrs/.test(t)) return "Enfermagem";
  if (/embelezamento|estética|cosmetol|pigmentação|beleza|cabeleireiro|esteticista|micropigmentação/.test(t)) return "Estética";
  if (/resíduos|pgrss|rss/.test(t)) return "Resíduos";
  if (/ilpi|idoso|longa permanência/.test(t)) return "ILPI";
  return "Transversal";
}

const BADGE_TIPO: Record<string, string> = {
  federal: "bg-blue-100 text-blue-700",
  federal_profissional: "bg-purple-100 text-purple-700",
  federal_tecnico: "bg-indigo-100 text-indigo-700",
  estadual: "bg-green-100 text-green-700",
  estadual_tecnico: "bg-teal-100 text-teal-700",
  municipal: "bg-orange-100 text-orange-700",
};

const BLANK_FORM = {
  estadoUf: "RJ", municipio: "", tipo: "estadual", titulo: "", referenciaAbnt: "", destaqueAbnt: "",
};

async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
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

export default function Legislacoes() {
  const [items, setItems] = useState<Legislacao[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEsfera, setFiltroEsfera] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Legislacao | null>(null);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEstado, setImportEstado] = useState("RJ");
  const [importMunicipio, setImportMunicipio] = useState("");
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [referenciasImportadas, setReferenciasImportadas] = useState<ReferenciaImportada[]>([]);
  const [selecionadasImportacao, setSelecionadasImportacao] = useState<Set<number>>(new Set());

  async function load() {
    const res = await fetch("/api/legislacoes");
    setItems(await res.json());
  }

  useEffect(() => { load(); }, []);

  // Client-side filtering
  const filtrados = items.filter((leg) => {
    if (filtroEstado && leg.estadoUf !== filtroEstado) return false;
    if (filtroEsfera && esferaDe(leg.tipo) !== filtroEsfera) return false;
    if (filtroSegmento && segmentoDe(leg.titulo, leg.referenciaAbnt) !== filtroSegmento) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!leg.titulo.toLowerCase().includes(q) && !leg.referenciaAbnt.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/legislacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          municipio: form.municipio.trim() || null,
          destaqueAbnt: form.destaqueAbnt.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao salvar referência.");
      setForm({ ...BLANK_FORM });
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Erro ao salvar referência.");
    } finally {
      setSaving(false);
    }
  }

  async function analisarArquivoLegislacoes() {
    if (!importFile) {
      setImportError("Selecione um arquivo .docx para analisar.");
      return;
    }
    setImportando(true);
    setImportError("");
    setImportMsg("");
    setImportPreview(null);
    setReferenciasImportadas([]);
    setSelecionadasImportacao(new Set());
    try {
      const formData = new FormData();
      formData.append("arquivo", importFile);
      formData.append("estadoUf", importEstado);
      formData.append("municipio", importMunicipio.trim());
      const response = await fetch("/api/legislacoes/importar", { method: "POST", body: formData });
      const data = await readJsonResponse<{
        referencias: ReferenciaImportada[];
        textoExtraidoPreview: string | null;
      }>(response, "Erro ao analisar arquivo.");
      setReferenciasImportadas(data.referencias || []);
      setSelecionadasImportacao(new Set((data.referencias || []).map((_, index) => index)));
      setImportPreview(data.textoExtraidoPreview);
      setImportMsg(
        data.referencias.length > 0
          ? `${data.referencias.length} referência(s) nova(s) encontrada(s).`
          : "Nenhuma referência nova foi encontrada. Se o documento tem referências, me avise: vamos ajustar o detector para esse formato."
      );
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erro ao analisar arquivo.");
    } finally {
      setImportando(false);
    }
  }

  async function adicionarReferenciasImportadas() {
    const selecionadas = referenciasImportadas.filter((_, index) => selecionadasImportacao.has(index));
    if (selecionadas.length === 0) return;

    setImportando(true);
    setImportError("");
    setImportMsg("");
    try {
      let adicionadas = 0;
      for (const referencia of selecionadas) {
        const response = await fetch("/api/legislacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(referencia),
        });
        await readJsonResponse<Legislacao>(response, "Erro ao adicionar referência.");
        adicionadas += 1;
      }
      setImportMsg(`${adicionadas} referência(s) adicionada(s) à base.`);
      setReferenciasImportadas((current) => current.filter((_, index) => !selecionadasImportacao.has(index)));
      setSelecionadasImportacao(new Set());
      await load();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Erro ao adicionar referências.");
    } finally {
      setImportando(false);
    }
  }

  function toggleImportada(index: number) {
    setSelecionadasImportacao((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/legislacoes/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estadoUf: editando.estadoUf,
          municipio: editando.municipio || null,
          tipo: editando.tipo,
          titulo: editando.titulo,
          referenciaAbnt: editando.referenciaAbnt,
          destaqueAbnt: editando.destaqueAbnt?.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar referência.");
      setEditando(null);
      await load();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erro ao atualizar referência.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletandoId(id);
    await fetch(`/api/legislacoes/${id}`, { method: "DELETE" });
    setDeletandoId(null);
    await load();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/legislacoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !ativo }),
    });
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Biblioteca de Legislações</h1>

      {/* ── Add form ────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Adicionar legislação</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">UF</label>
            <select value={form.estadoUf} onChange={(e) => setForm({ ...form, estadoUf: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf === "BR" ? "BR — Federal" : uf}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Município (opcional)</label>
            <input type="text" value={form.municipio} placeholder="Deixe vazio = estadual"
              onChange={(e) => setForm({ ...form, municipio: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
              {TIPOS_FORM.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
            <input type="text" value={form.titulo} placeholder="ex: Lei Complementar nº 70/2009"
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Referência ABNT completa</label>
          <textarea rows={3} value={form.referenciaAbnt}
            placeholder="AMAZONAS. Lei Complementar nº 70, de 03 de dezembro de 2009..."
            onChange={(e) => setForm({ ...form, referenciaAbnt: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Trecho em negrito na referência (opcional)</label>
          <input type="text" value={form.destaqueAbnt}
            placeholder="Título do manual, periódico ou obra a destacar"
            onChange={(e) => setForm({ ...form, destaqueAbnt: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
          <p className="text-xs text-gray-500 mt-1">Para leis e resoluções, o app identifica automaticamente o ato normativo.</p>
        </div>
        {formError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}
        <button type="submit" disabled={saving || !form.titulo || !form.referenciaAbnt}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Salvando..." : "Adicionar"}
        </button>
      </form>

      <section className="bg-white border border-amber-200 rounded-xl p-5 mb-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">Importar legislações do Documento em Elaboração</h2>
          <p className="text-xs text-gray-500 mt-1">
            Envie um DOCX com a seção de referências. O app detecta o que ainda não está na base, remove duplicatas aproximadas e deixa você revisar antes de adicionar.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_120px_180px_auto] md:items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Arquivo .docx</label>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              disabled={importando}
              className="block w-full text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">UF padrão</label>
            <select
              value={importEstado}
              onChange={(e) => setImportEstado(e.target.value)}
              disabled={importando}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white disabled:opacity-50"
            >
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Município padrão</label>
            <input
              type="text"
              value={importMunicipio}
              onChange={(e) => setImportMunicipio(e.target.value)}
              disabled={importando}
              placeholder="opcional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={() => { void analisarArquivoLegislacoes(); }}
            disabled={importando || !importFile}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {importando ? "Analisando..." : "Analisar"}
          </button>
        </div>

        {importError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {importError}
          </p>
        )}
        {importMsg && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {importMsg}
          </p>
        )}

        {referenciasImportadas.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-amber-200">
            <div className="flex items-center justify-between gap-3 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900">
                {selecionadasImportacao.size} de {referenciasImportadas.length} selecionada(s)
              </p>
              <button
                type="button"
                onClick={() => { void adicionarReferenciasImportadas(); }}
                disabled={importando || selecionadasImportacao.size === 0}
                className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Adicionar selecionadas
              </button>
            </div>
            <ul className="divide-y divide-amber-100">
              {referenciasImportadas.map((referencia, index) => (
                <li key={`${referencia.referenciaAbnt}-${index}`} className="flex items-start gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selecionadasImportacao.has(index)}
                    onChange={() => toggleImportada(index)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300 text-amber-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{referencia.titulo}</p>
                    <p className="text-xs text-gray-500">
                      {referencia.tipo} · {referencia.estadoUf}
                      {referencia.municipio ? ` · ${referencia.municipio}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-gray-700">{referencia.referenciaAbnt}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {importPreview && referenciasImportadas.length === 0 && (
          <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-gray-700">Ver texto extraído do DOCX</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-gray-600">{importPreview}</pre>
          </details>
        )}
      </section>

      {/* ── Filters + list ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl">
        {/* Header + filters */}
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Legislações cadastradas{" "}
              <span className="text-gray-400 font-normal">({filtrados.length} de {items.length})</span>
            </h2>
          </div>
          {/* Search + filters row */}
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou referência..."
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white"
            />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white">
              <option value="">Todos os estados</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf === "BR" ? "Federal (BR)" : uf}</option>)}
            </select>
            <select value={filtroEsfera} onChange={(e) => setFiltroEsfera(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white">
              <option value="">Todas as esferas</option>
              <option value="federal">Federal</option>
              <option value="estadual">Estadual</option>
              <option value="municipal">Municipal</option>
            </select>
            <select value={filtroSegmento} onChange={(e) => setFiltroSegmento(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white">
              <option value="">Todos os segmentos</option>
              <option value="Transversal">Transversal</option>
              <option value="Estética">Estética</option>
              <option value="Enfermagem">Enfermagem</option>
              <option value="Resíduos">Resíduos</option>
              <option value="ILPI">ILPI</option>
            </select>
            {(busca || filtroEstado || filtroEsfera || filtroSegmento) && (
              <button onClick={() => { setBusca(""); setFiltroEstado(""); setFiltroEsfera(""); setFiltroSegmento(""); }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50">
                ✕ Limpar
              </button>
            )}
          </div>
        </div>

        {filtrados.length === 0 && (
          <p className="px-5 py-6 text-gray-600 text-sm">Nenhuma legislação encontrada.</p>
        )}

        <ul className="divide-y divide-gray-100">
          {filtrados.map((leg) => (
            <li key={leg.id} className={`px-5 py-4 ${!leg.ativo ? "opacity-40" : ""}`}>
              <div className="flex items-start gap-4">
                {/* Badges */}
                <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${BADGE_TIPO[leg.tipo] || "bg-gray-100 text-gray-600"}`}>
                    {leg.estadoUf}
                  </span>
                  {leg.municipio && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-center">
                      {leg.municipio}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{leg.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{leg.referenciaAbnt}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {TIPOS_FORM.find(t => t.value === leg.tipo)?.label || leg.tipo}
                    {" · "}
                    {segmentoDe(leg.titulo, leg.referenciaAbnt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditError(""); setEditando({ ...leg }); }}
                    className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                    Editar
                  </button>
                  <button onClick={() => toggleAtivo(leg.id, leg.ativo)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${leg.ativo ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}>
                    {leg.ativo ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Excluir "${leg.titulo}"?`)) handleDelete(leg.id); }}
                    disabled={deletandoId === leg.id}
                    className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                    {deletandoId === leg.id ? "..." : "Excluir"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Edit modal ─────────────────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleEdit}
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900">Editar legislação</h2>
              <button type="button" onClick={() => setEditando(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">UF</label>
                <select value={editando.estadoUf} onChange={(e) => setEditando({ ...editando, estadoUf: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf === "BR" ? "BR — Federal" : uf}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Município</label>
                <input type="text" value={editando.municipio || ""}
                  onChange={(e) => setEditando({ ...editando, municipio: e.target.value || null })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  {TIPOS_FORM.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Título</label>
              <input type="text" value={editando.titulo}
                onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            {editError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Referência ABNT</label>
              <textarea rows={4} value={editando.referenciaAbnt}
                onChange={(e) => setEditando({ ...editando, referenciaAbnt: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Trecho em negrito (opcional)</label>
              <input type="text" value={editando.destaqueAbnt || ""}
                onChange={(e) => setEditando({ ...editando, destaqueAbnt: e.target.value || null })}
                placeholder="Título da obra, manual ou periódico"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditando(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
