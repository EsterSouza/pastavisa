"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { findBestTemplateMatch } from "@/lib/template-matcher";

interface Documento {
  id: string;
  nomeArquivo: string;
  status: string;
  templateId: string | null;
  tokensUsados: number | null;
  mensagemErro: string | null;
  avisoRtNoCorpo: boolean;
  logoSubstituida: boolean | null;
  equipamentosSelecionados: string | null;
  template?: Template | null;
}

interface Template {
  id: string;
  nome: string;
  tipo: string;
  arquivoPath?: string | null;
  processingType?: string;
}

interface Legislacao {
  id: string;
  estadoUf: string;
  municipio: string | null;
  titulo: string;
  tipo: string;
}

interface Equipamento {
  nome: string;
  marca: string;
  modelo: string;
  registro_anvisa: string;
}

const STATUS_ICON: Record<string, string> = {
  pendente:    "○",
  processando: "●",
  gerado:      "✓",
  erro:        "×",
};

const STATUS_COLOR: Record<string, string> = {
  pendente:    "text-gray-400",
  processando: "text-yellow-500 animate-pulse",
  gerado:      "text-green-600",
  erro:        "text-red-500",
};

// â”€â”€â”€ Token cost helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Blended estimate: ~70% input, 30% output â€” Haiku-dominant workloads.
// Haiku:  $0.80/M input + $4.00/M output â†’ blended â‰ˆ $1.76/M
// We use $2.00/M as a conservative upper bound.
const USD_PER_TOKEN = 2.0 / 1_000_000;
const BRL_PER_USD   = 5.80; // approximate fixed rate

function formatCost(tokens: number): { usd: string; brl: string } {
  const usd = tokens * USD_PER_TOKEN;
  const brl = usd * BRL_PER_USD;
  return {
    usd: usd < 0.01 ? `< US$ 0,01` : `~US$ ${usd.toFixed(2).replace(".", ",")}`,
    brl: brl < 0.05 ? `< R$ 0,05`  : `~R$ ${brl.toFixed(2).replace(".", ",")}`,
  };
}

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function equipamentoKey(eq: Equipamento): string {
  return [eq.nome, eq.marca, eq.modelo, eq.registro_anvisa]
    .map((value) => (value || "").trim().toLowerCase())
    .join("|");
}

function equipamentoLabel(eq: Equipamento): string {
  const detalhes = [eq.marca, eq.modelo].map((p) => p?.trim()).filter(Boolean).join(" ");
  const registro = eq.registro_anvisa?.trim() ? `ANVISA ${eq.registro_anvisa.trim()}` : "";
  return [eq.nome?.trim() || "Equipamento", detalhes, registro].filter(Boolean).join(" · ");
}

function parseEquipamentos(value?: string | null): Equipamento[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPopDocumento(doc: Documento, assignments: Record<string, string>, templates: Template[]): boolean {
  const template = templates.find((t) => t.id === assignments[doc.id]) || doc.template || null;
  const tipo = normalizeForMatch(template?.tipo || "");
  const nome = normalizeForMatch(`${doc.nomeArquivo} ${template?.nome || ""}`);
  return tipo === "pop" || nome.startsWith("pop ") || nome.includes(" pop ");
}

function sugerirEquipamentosParaPop(doc: Documento, template: Template | null, equipamentos: Equipamento[]): Equipamento[] {
  const alvo = normalizeForMatch(`${doc.nomeArquivo} ${template?.nome || ""}`);
  const regras: Array<{ termos: string[]; gatilhos: string[] }> = [
    { termos: ["autoclave"], gatilhos: ["esteriliz", "processamento", "materiais", "instrument"] },
    { termos: ["laser", "led", "fotobiomodul"], gatilhos: ["laser", "led", "fotobiomodul"] },
    { termos: ["plasma", "jato"], gatilhos: ["plasma", "jato"] },
    { termos: ["centrifug"], gatilhos: ["centrifug", "hemoderiv", "prp", "prf", "plasma gel"] },
    { termos: ["dermografo", "dermógrafo", "caneta"], gatilhos: ["micropigment", "bb glow", "dermograf"] },
    { termos: ["refrigerador", "geladeira"], gatilhos: ["refriger", "temperatura", "armazen"] },
    { termos: ["purificador"], gatilhos: ["agua", "purific"] },
  ];

  return equipamentos.filter((eq) => {
    const equipamentoTexto = normalizeForMatch(`${eq.nome} ${eq.marca} ${eq.modelo}`);
    const partes = equipamentoTexto.split(/[^a-z0-9]+/).filter((p) => p.length >= 4);
    if (partes.some((parte) => alvo.includes(parte))) return true;

    return regras.some((regra) =>
      regra.termos.some((termo) => equipamentoTexto.includes(normalizeForMatch(termo))) &&
      regra.gatilhos.some((gatilho) => alvo.includes(normalizeForMatch(gatilho)))
    );
  });
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}min ${rest}s` : `${minutes}min`;
}

export default function ProcessarPasta() {
  const { id } = useParams<{ id: string }>();

  const [docs,       setDocs]       = useState<Documento[]>([]);
  const [templates,  setTemplates]  = useState<Template[]>([]);
  const [legislacoes,setLegislacoes]= useState<Legislacao[]>([]);
  const [clienteEquipamentos,setClienteEquipamentos]= useState<Equipamento[]>([]);
  const [selectedLeg,setSelectedLeg]= useState<string[]>([]);
  const [assignments,setAssignments]= useState<Record<string, string>>({});
  const [equipmentAssignments,setEquipmentAssignments]= useState<Record<string, Equipamento[]>>({});
  const [selectedDocs,setSelectedDocs] = useState<Set<string>>(new Set());
  const [processing,  setProcessing]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [batchDone,   setBatchDone]   = useState(0);
  const [batchTotal,  setBatchTotal]  = useState(0);
  const [confirmRegerar, setConfirmRegerar] = useState<string[]>([]);
  const [estadoCliente,  setEstadoCliente]  = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [currentDocName, setCurrentDocName] = useState("");
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Prevent auto-assign from running more than once
  const autoAssigned = useRef(false);

  // â”€â”€ Load data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    // 1. Fetch pasta (for state) â†’ fetch legislaÃ§Ãµes
    fetch(`/api/pastas/${id}`)
      .then((r) => r.json())
      .then((pasta) => {
        const estado = pasta.clienteEstado || "";
        setEstadoCliente(estado);
        setClienteEquipamentos(parseEquipamentos(pasta.clienteEquipamentos));
        if (!estado) return;
        return fetch(`/api/legislacoes?estado=${estado}`)
          .then((r) => r.json())
          .then((legs: Legislacao[]) => {
            setLegislacoes(legs);
            // Auto-select all â€” they are all included by default
            setSelectedLeg(legs.map((l) => l.id));
          });
      });

    // 2. Fetch documents
    fetch(`/api/pastas/${id}/documentos`)
      .then((r) => r.json())
      .then((data: Array<Partial<Documento> & { id: string; nomeArquivo: string; status: string }>) => {
        const normalized = data.map((d) => ({
          avisoRtNoCorpo: false,
          logoSubstituida: null,
          tokensUsados: null,
          mensagemErro: null,
          templateId: null,
          equipamentosSelecionados: null,
          ...d,
        })) as Documento[];
        setDocs(normalized);

        // Restore previously saved assignments
        const init: Record<string, string> = {};
        normalized.forEach((d) => { if (d.templateId) init[d.id] = d.templateId; });
        setAssignments(init);

        const equipmentInit: Record<string, Equipamento[]> = {};
        normalized.forEach((d) => {
          equipmentInit[d.id] = parseEquipamentos(d.equipamentosSelecionados);
        });
        setEquipmentAssignments(equipmentInit);

        // Default: select all pending docs
        setSelectedDocs(new Set(normalized.filter((d) => d.status === "pendente").map((d) => d.id)));
      });

    // 3. Fetch templates
    fetch("/api/templates")
      .then((r) => r.json())
      .then((ts: Template[]) =>
        setTemplates(ts.filter((t: Template & { ativo?: boolean }) => t.ativo !== false))
      );
  }, [id]);

  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [processing]);

  // â”€â”€ Auto-assign templates once both docs and templates are loaded â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (autoAssigned.current) return;
    if (docs.length === 0 || templates.length === 0) return;
    autoAssigned.current = true;

    const toSave: Array<{ docId: string; templateId: string }> = [];

    setAssignments((prev) => {
      const next = { ...prev };
      for (const doc of docs) {
        if (next[doc.id]) continue; // keep already-saved assignments (from DB)
        const match = findBestTemplateMatch(doc.nomeArquivo, templates);
        if (match) {
          next[doc.id] = match.templateId;
          toSave.push({ docId: doc.id, templateId: match.templateId });
        }
      }
      return next;
    });

    // Persist auto-matched assignments to DB so they survive page reload.
    // Fire-and-forget â€” UI is already updated optimistically above.
    if (toSave.length > 0) {
      Promise.all(
        toSave.map(({ docId, templateId }) =>
          fetch(`/api/pastas/${id}/documentos`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ docId, templateId }),
          })
        )
      ).catch(console.error);
    }
  }, [docs, templates, id]);

  // â”€â”€ Selection helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function toggleDoc(docId: string) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }

  function selecionarTodos()    { setSelectedDocs(new Set(docs.map((d) => d.id))); }
  function selecionarPendentes(){ setSelectedDocs(new Set(docs.filter((d) => d.status !== "gerado").map((d) => d.id))); }
  function desselecionarTodos() { setSelectedDocs(new Set()); }

  function salvarEquipamentosDoDoc(docId: string, equipamentos: Equipamento[]) {
    fetch(`/api/pastas/${id}/documentos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId, equipamentosSelecionados: JSON.stringify(equipamentos) }),
    }).catch(console.error);
  }

  function toggleEquipamentoDoc(docId: string, equipamento: Equipamento) {
    setEquipmentAssignments((prev) => {
      const atuais = prev[docId] || [];
      const key = equipamentoKey(equipamento);
      const exists = atuais.some((eq) => equipamentoKey(eq) === key);
      const nextForDoc = exists
        ? atuais.filter((eq) => equipamentoKey(eq) !== key)
        : [...atuais, equipamento];
      salvarEquipamentosDoDoc(docId, nextForDoc);
      return { ...prev, [docId]: nextForDoc };
    });
  }

  function aplicarSugestaoEquipamentos(doc: Documento) {
    const template = templates.find((t) => t.id === assignments[doc.id]) || doc.template || null;
    const sugeridos = sugerirEquipamentosParaPop(doc, template, clienteEquipamentos);
    setEquipmentAssignments((prev) => ({ ...prev, [doc.id]: sugeridos }));
    salvarEquipamentosDoDoc(doc.id, sugeridos);
  }

  function limparEquipamentosDoc(docId: string) {
    setEquipmentAssignments((prev) => ({ ...prev, [docId]: [] }));
    salvarEquipamentosDoDoc(docId, []);
  }

  // â”€â”€ Generation â€” one document at a time for real-time progress â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function autoPreencherTemplates() {
    setAutoFilling(true);
    try {
      const response = await fetch(`/api/pastas/${id}/documentos/auto-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao preencher templates");

      const normalized = ((data.documentos || []) as Array<
        Partial<Documento> & { id: string; nomeArquivo: string; status: string }
      >).map((d) => ({
        avisoRtNoCorpo: false,
        logoSubstituida: null,
        tokensUsados: null,
        mensagemErro: null,
        templateId: null,
        equipamentosSelecionados: null,
        ...d,
      })) as Documento[];

      setDocs(normalized);
      const next: Record<string, string> = {};
      normalized.forEach((doc) => {
        if (doc.templateId) next[doc.id] = doc.templateId;
      });
      setAssignments(next);
      const nextEquipment: Record<string, Equipamento[]> = {};
      normalized.forEach((doc) => {
        nextEquipment[doc.id] = parseEquipamentos(doc.equipamentosSelecionados);
      });
      setEquipmentAssignments(nextEquipment);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao preencher templates");
    } finally {
      setAutoFilling(false);
    }
  }

  async function handleGerar(ignorarJaGerados = false) {
    const docsSelecionados = docs.filter((d) => selectedDocs.has(d.id) && assignments[d.id]);

    if (!ignorarJaGerados) {
      const jaGeradosNomes = docsSelecionados
        .filter((d) => d.status === "gerado")
        .map((d) => d.nomeArquivo);
      if (jaGeradosNomes.length > 0) {
        setConfirmRegerar(jaGeradosNomes);
        return;
      }
    }
    setConfirmRegerar([]);
    setProcessing(true);
    setDone(false);
    setBatchDone(0);
    setBatchTotal(docsSelecionados.length);
    setGenerationStartedAt(Date.now());
    setCurrentDocName("");

    try {
      for (const doc of docsSelecionados) {
        setCurrentDocName(doc.nomeArquivo);
        // 1. Save template assignment
        await fetch(`/api/pastas/${id}/documentos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docId: doc.id,
            templateId: assignments[doc.id],
            equipamentosSelecionados: JSON.stringify(equipmentAssignments[doc.id] || []),
          }),
        });

        // 2. Mark as processing (immediate UI feedback)
        setDocs((prev) =>
          prev.map((d) => d.id === doc.id ? { ...d, status: "processando" } : d)
        );

        // 3. Generate this document only
        const res = await fetch("/api/gerar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pastaId: id,
            documentoIds: [doc.id],
            legislacaoIds: selectedLeg,
          }),
        });

        const result = await res.json();
        const r = result.results?.[0] as {
          id: string;
          status: string;
          error?: string;
          avisoRt?: boolean;
          logoSubstituida?: boolean;
          tokensUsados?: number;
        } | undefined;

        // 4. Update this document's status and increment batch counter
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  status:          r?.status ?? "erro",
                  mensagemErro:    r?.error || null,
                  avisoRtNoCorpo:  r?.avisoRt ?? d.avisoRtNoCorpo,
                  logoSubstituida: r?.logoSubstituida ?? d.logoSubstituida,
                  tokensUsados:    r?.tokensUsados ?? d.tokensUsados,
                }
              : d
          )
        );
        setBatchDone((n) => n + 1);
      }
    } catch (err) {
      console.error("[processar] erro na geraÃ§Ã£o:", err);
    } finally {
      // Always release the processing lock so the UI never freezes
      setProcessing(false);
      setCurrentDocName("");
      setDone(true);
    }
  }

  // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gerados      = docs.filter((d) => d.status === "gerado").length;
  const erros        = docs.filter((d) => d.status === "erro").length;
  const total        = docs.length;
  const concluidos   = gerados + erros;
  const progress     = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const prontoParaGerar = docs.filter((d) => selectedDocs.has(d.id) && assignments[d.id]).length;
  const totalTokens  = docs.reduce((s, d) => s + (d.tokensUsados ?? 0), 0);
  const custo        = formatCost(totalTokens);
  const lotePercent = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0;
  const elapsedSeconds = generationStartedAt ? Math.max(0, Math.round((now - generationStartedAt) / 1000)) : 0;
  const averageSeconds = batchDone > 0 ? elapsedSeconds / batchDone : 0;
  const remainingSeconds = processing && averageSeconds > 0
    ? Math.max(0, Math.round(averageSeconds * (batchTotal - batchDone)))
    : null;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gerar documentos</h1>

      {/* â”€â”€ Documents list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white border border-gray-200 rounded-xl mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Documentos a gerar</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Templates auto-selecionados por nome - revise e ajuste se necessário
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={autoPreencherTemplates}
              disabled={processing || autoFilling}
              className="text-xs text-emerald-700 hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {autoFilling ? "Preenchendo..." : "Auto preencher"}
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={selecionarTodos}     className="text-xs text-blue-600 hover:underline">Todos</button>
            <span className="text-gray-300">|</span>
            <button onClick={selecionarPendentes} className="text-xs text-blue-500 hover:underline">Pendentes/erros</button>
            <span className="text-gray-300">|</span>
            <button onClick={desselecionarTodos}  className="text-xs text-gray-500 hover:underline">Nenhum</button>
          </div>
        </div>

        {docs.length === 0 && (
          <p className="px-5 py-6 text-gray-600 text-sm">Nenhum documento extraído.</p>
        )}

        <ul className="divide-y divide-gray-100">
          {docs.map((doc) => {
            const isSelecionado = selectedDocs.has(doc.id);
            const jaGerado      = doc.status === "gerado";
            const templateAtual = templates.find((t) => t.id === assignments[doc.id]) || doc.template || null;
            const isPop = isPopDocumento(doc, assignments, templates);
            const equipamentosDoc = equipmentAssignments[doc.id] || [];
            const equipamentosDocKeys = new Set(equipamentosDoc.map(equipamentoKey));

            return (
              <li key={doc.id} className="px-5 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelecionado}
                    disabled={processing}
                    onChange={() => toggleDoc(doc.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  />

                  {/* Status icon */}
                  <span className={`text-base w-4 text-center shrink-0 font-mono ${STATUS_COLOR[doc.status] ?? "text-gray-400"}`}>
                    {STATUS_ICON[doc.status] ?? "○"}
                  </span>

                  {/* Document name */}
                  <span className={`flex-1 text-sm min-w-0 truncate ${jaGerado && !isSelecionado ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {doc.nomeArquivo}
                    {jaGerado && isSelecionado && (
                      <span className="ml-2 text-xs text-amber-600 font-medium">(vai regerar)</span>
                    )}
                  </span>

                  {/* Template selector */}
                  <select
                    value={assignments[doc.id] ?? ""}
                    onChange={(e) => {
                      const templateId = e.target.value;
                      setAssignments((prev) => ({ ...prev, [doc.id]: templateId }));
                      // Persist selection immediately so it survives reload
                      fetch(`/api/pastas/${id}/documentos`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ docId: doc.id, templateId: templateId || null }),
                      }).catch(console.error);
                    }}
                    disabled={processing}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 max-w-[220px] text-gray-900 bg-white disabled:opacity-50 shrink-0"
                  >
                    <option value="">- template -</option>
                    {[...templates]
                      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                  </select>

                  {/* Tokens per doc */}
                  {doc.tokensUsados ? (
                    <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                      {doc.tokensUsados.toLocaleString("pt-BR")} tk
                    </span>
                  ) : null}

                  {/* Error indicator */}
                  {doc.mensagemErro && (
                    <span
                      className="text-xs text-red-500 shrink-0 cursor-help underline decoration-dotted"
                      title={doc.mensagemErro}
                    >
                      Erro
                    </span>
                  )}
                </div>

                {/* Post-generation badges */}
                {jaGerado && (
                  <div className="flex items-center gap-2 pl-11">
                    {doc.avisoRtNoCorpo && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
                        ! Revisar RT no corpo
                      </span>
                    )}
                    {doc.logoSubstituida === true && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                        ✓ Logo substituída
                      </span>
                    )}
                    {doc.logoSubstituida === false && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                        ! Logo não substituída
                      </span>
                    )}
                  </div>
                )}

                {isPop && clienteEquipamentos.length > 0 && (
                  <div className="ml-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">Equipamentos na seção de materiais</p>
                        <p className="text-[11px] text-slate-500">
                          {equipamentosDoc.length} selecionado{equipamentosDoc.length !== 1 ? "s" : ""} para este POP
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => aplicarSugestaoEquipamentos(doc)}
                          disabled={processing || !templateAtual}
                          className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
                          Sugerir
                        </button>
                        <button
                          type="button"
                          onClick={() => limparEquipamentosDoc(doc.id)}
                          disabled={processing || equipamentosDoc.length === 0}
                          className="text-gray-500 hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {clienteEquipamentos.map((eq) => {
                        const key = equipamentoKey(eq);
                        return (
                          <label key={key} className="flex items-start gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={equipamentosDocKeys.has(key)}
                              disabled={processing}
                              onChange={() => toggleEquipamentoDoc(doc.id, eq)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                            />
                            <span>{equipamentoLabel(eq)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* â”€â”€ LegislaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {legislacoes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl mb-6 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">
              Legislações - {estadoCliente}
            </h2>
            <div className="flex gap-3 text-xs">
              <button
                onClick={() => setSelectedLeg(legislacoes.map((l) => l.id))}
                className="text-blue-600 hover:underline"
              >
                Todas
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setSelectedLeg([])}
                className="text-gray-500 hover:underline"
              >
                Nenhuma
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {selectedLeg.length} de {legislacoes.length} selecionadas - incluídas automaticamente nos documentos
          </p>
          <div className="space-y-2">
            {legislacoes.map((leg) => (
              <label key={leg.id} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedLeg.includes(leg.id)}
                  onChange={(e) =>
                    setSelectedLeg((prev) =>
                      e.target.checked ? [...prev, leg.id] : prev.filter((l) => l !== leg.id)
                    )
                  }
                  className="mt-0.5 w-4 h-4 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                    {leg.titulo}
                  </p>
                  <p className="text-xs text-gray-500">
                    {leg.tipo}
                    {leg.estadoUf === "BR" ? " · Federal" : ` · ${leg.estadoUf}`}
                    {leg.municipio ? ` · ${leg.municipio}` : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€ Progress bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {(processing || done) && total > 0 && (
        <div className={`mb-4 space-y-3 rounded-xl border px-4 py-3 ${
          processing ? "border-blue-200 bg-blue-50" : erros > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
        }`}>
          <div className="flex justify-between text-xs text-gray-600">
            <span className="font-semibold text-gray-800">
              {processing
                ? `Gerando agora: ${batchDone} de ${batchTotal} concluídos`
                : concluidos === total
                ? `Finalizado: ${gerados} gerados${erros ? `, ${erros} com erro` : ""}`
                : `Parcial: ${concluidos} de ${total} concluídos (${gerados} gerados${erros ? `, ${erros} com erro` : ""})`}
            </span>
            <span className="font-medium tabular-nums">
              {processing ? `${lotePercent}% do lote` : `${progress}% da pasta`}
            </span>
          </div>
          {processing && (
            <div className="grid gap-1 text-xs text-gray-600 sm:grid-cols-3">
              <span>Atual: <strong className="text-gray-800">{currentDocName || "preparando..."}</strong></span>
              <span>Decorrido: <strong className="text-gray-800">{formatDuration(elapsedSeconds)}</strong></span>
              <span>Restante: <strong className="text-gray-800">{remainingSeconds === null ? "calculando..." : formatDuration(remainingSeconds)}</strong></span>
            </div>
          )}
          {!processing && concluidos < total && (
            <p className="text-xs text-amber-700">
              Ainda há {total - concluidos} documento{total - concluidos !== 1 ? "s" : ""} pendente{total - concluidos !== 1 ? "s" : ""}. Selecione pendentes/erros para continuar.
            </p>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${processing ? "bg-blue-600" : erros > 0 ? "bg-amber-500" : "bg-green-600"}`}
              style={{
                width: processing && batchTotal > 0
                  ? `${lotePercent}%`
                  : `${progress}%`,
              }}
            />
          </div>

          {/* Token cost summary */}
          {totalTokens > 0 && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              <span className="text-base">$</span>
              <span>
                <span className="font-semibold text-gray-800">
                  {totalTokens.toLocaleString("pt-BR")} tokens
                </span>
                {" "}utilizados
              </span>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-blue-700">{custo.usd}</span>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-green-700">{custo.brl}</span>
              <span className="text-gray-400 ml-auto">(estimativa - taxa blended Haiku)</span>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Action buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex gap-3">
        <button
          onClick={() => { void handleGerar(); }}
          disabled={processing || prontoParaGerar === 0}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processing
            ? `Gerando... ${batchDone}/${batchTotal}`
            : prontoParaGerar === 0
            ? "Selecione ao menos um documento com template"
            : `Gerar ${prontoParaGerar} documento${prontoParaGerar !== 1 ? "s" : ""}`}
        </button>

        {done && gerados > 0 && (() => {
          // IDs of docs that are checked AND already generated
          const selectedGeradosIds = docs
            .filter((d) => d.status === "gerado" && selectedDocs.has(d.id))
            .map((d) => d.id);
          const downloadUrl =
            selectedGeradosIds.length > 0 && selectedGeradosIds.length < gerados
              ? `/api/pastas/${id}/download?ids=${selectedGeradosIds.join(",")}`
              : `/api/pastas/${id}/download`;
          const label =
            selectedGeradosIds.length > 0 && selectedGeradosIds.length < gerados
              ? `↓ ZIP (${selectedGeradosIds.length} selecionados)`
              : `↓ ZIP (${gerados} docs)`;
          return (
            <a
              href={downloadUrl}
              className="bg-green-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-green-700 text-center transition-colors text-sm whitespace-nowrap"
            >
              {label}
            </a>
          );
        })()}
      </div>

      {templates.length === 0 && (
        <p className="mt-4 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Nenhum template cadastrado ainda. Cadastre em{" "}
          <a href="/templates" className="underline">Templates</a> antes de gerar.
        </p>
      )}

      {/* â”€â”€ Confirmation modal for regeneration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {confirmRegerar.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Regenerar documentos?</h3>
            <p className="text-sm text-gray-600 mb-3">
              Os documentos abaixo já foram gerados. Deseja gerá-los novamente? O arquivo anterior será substituído.
            </p>
            <ul className="text-sm text-gray-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 space-y-1 overflow-y-auto min-h-0 max-h-[55vh]">
              {confirmRegerar.map((nome) => (
                <li key={nome} className="flex items-center gap-2">
                  <span className="text-amber-500">!</span> {nome}
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRegerar([])}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleGerar(true); }}
                className="flex-1 bg-amber-600 text-white py-2 rounded-lg font-medium hover:bg-amber-700"
              >
                Sim, regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
