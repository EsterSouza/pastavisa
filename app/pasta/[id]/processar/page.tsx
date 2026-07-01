"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { findBestTemplateMatch } from "@/lib/template-matcher";

interface Documento {
  id: string;
  nomeArquivo: string;
  status: string;
  templateId: string | null;
  outputPath: string | null;
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
  referenciaAbnt?: string;
  destaqueAbnt?: string | null;
  ativo?: boolean;
}

interface ReferenciaNaoCadastrada {
  estadoUf: string;
  municipio?: string | null;
  tipo: string;
  titulo: string;
  referenciaAbnt: string;
  destaqueAbnt?: string | null;
  ativo: boolean;
}

interface Equipamento {
  tipo?: string;
  nome: string;
  marca: string;
  modelo: string;
  registro_anvisa: string;
  categoria?: string;
  fabricante?: string;
  uso?: string;
}

interface ProdutoInsumo {
  nome: string;
  categoria: string;
  fabricante: string;
  registro_anvisa: string;
  uso: string;
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
// Each doc is billed at the rate of the model its template actually uses
// (see lib/classifier.ts modelForType) — mixing every doc into a single
// Haiku-only rate was underestimating spend on SONNET_REQUIRED documents
// (POP, TCLE, MBP, PGRSS...) by several times.
// Haiku:  $0.80/M input + $4.00/M output  -> blended ~= $1.76/M -> use $2.00/M
// Sonnet: $3.00/M input + $15.00/M output -> blended ~= $6.60/M -> use $7.00/M
const USD_PER_TOKEN = 2.0 / 1_000_000;
const USD_PER_TOKEN_SONNET = 7.0 / 1_000_000;
const BRL_PER_USD   = 5.80; // approximate fixed rate

function formatCost(usd: number): { usd: string; brl: string } {
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
  return [eq.tipo || "equipamento", eq.nome, eq.marca, eq.modelo, eq.registro_anvisa, eq.categoria, eq.fabricante, eq.uso]
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

function parseProdutosInsumos(value?: string | null): ProdutoInsumo[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function produtoInsumoToMaterial(item: ProdutoInsumo): Equipamento {
  return {
    tipo: "insumo",
    nome: item.nome,
    marca: "",
    modelo: "",
    registro_anvisa: item.registro_anvisa,
    categoria: item.categoria,
    fabricante: item.fabricante,
    uso: item.uso,
  };
}

function parseStringList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getTemplateAtual(doc: Documento, assignments: Record<string, string>, templates: Template[]): Template | null {
  return templates.find((t) => t.id === assignments[doc.id]) || doc.template || null;
}

function isPopDocumento(doc: Documento, assignments: Record<string, string>, templates: Template[]): boolean {
  const template = getTemplateAtual(doc, assignments, templates);
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

// â”€â”€â”€ Material groups (equipamentos / insumos / medicamentos / cosmeticos / saneantes) â”€
// Equipamentos e produtos da tabela de insumos sao especificados em GRUPOS separados
// no POP, porque as tabelas sao entregues separadas no documento de planejamento.
const MATERIAL_GROUPS: Array<{ id: string; label: string }> = [
  { id: "equipamento", label: "Equipamentos" },
  { id: "insumo",      label: "Insumos" },
  { id: "medicamento", label: "Medicamentos" },
  { id: "cosmetico",   label: "Cosméticos" },
  { id: "saneante",    label: "Saneantes" },
  { id: "produto",     label: "Outros produtos" },
];

const MATERIAL_GROUP_LABEL: Record<string, string> = Object.fromEntries(
  MATERIAL_GROUPS.map((g) => [g.id, g.label])
);

function classificarMaterialGroup(item: Equipamento): string {
  if ((item.tipo || "equipamento") !== "insumo") return "equipamento";
  const texto = normalizeForMatch([item.categoria, item.uso, item.nome].filter(Boolean).join(" "));
  if (/medicament|farmac|injetav|vacina|anestes|antibiot|\bsoro\b/.test(texto)) return "medicamento";
  if (/cosmet/.test(texto)) return "cosmetico";
  if (/saneant|desinfet|germicid|detergent|\blimpeza\b/.test(texto)) return "saneante";
  if (/insumo|descartav|seringa|agulha|\bgaze\b|\bluva|material|curativ/.test(texto)) return "insumo";
  return "produto";
}

function buildMaterialGroups(
  equipamentos: Equipamento[],
  insumos: Equipamento[],
): Array<{ id: string; label: string; itens: Equipamento[] }> {
  const todos = [...equipamentos, ...insumos];
  return MATERIAL_GROUPS
    .map((g) => ({ id: g.id, label: g.label, itens: todos.filter((item) => classificarMaterialGroup(item) === g.id) }))
    .filter((g) => g.itens.length > 0);
}

// Composite key so a single Record holds the open/closed state of every group per doc.
function grupoAbertoKey(docId: string, groupId: string): string {
  return `${docId}::${groupId}`;
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
  const searchParams = useSearchParams();
  const regenerarAposEdicao = searchParams.get("regenerar") === "dados";

  const [docs,       setDocs]       = useState<Documento[]>([]);
  const [templates,  setTemplates]  = useState<Template[]>([]);
  const [legislacoes,setLegislacoes]= useState<Legislacao[]>([]);
  const [clienteEquipamentos,setClienteEquipamentos]= useState<Equipamento[]>([]);
  const [clienteProdutosInsumos, setClienteProdutosInsumos] = useState<ProdutoInsumo[]>([]);
  const [selectedLeg,setSelectedLeg]= useState<string[]>([]);
  const [assignments,setAssignments]= useState<Record<string, string>>({});
  const [equipmentAssignments,setEquipmentAssignments]= useState<Record<string, Equipamento[]>>({});
  const [equipmentOptionsOpen,setEquipmentOptionsOpen]= useState<Record<string, boolean>>({});
  const [selectedDocs,setSelectedDocs] = useState<Set<string>>(new Set());
  const [processing,  setProcessing]  = useState(false);
  const [done,        setDone]        = useState(false);
  const [batchDone,   setBatchDone]   = useState(0);
  const [batchTotal,  setBatchTotal]  = useState(0);
  const [confirmRegerar, setConfirmRegerar] = useState<string[]>([]);
  const [estadoCliente,  setEstadoCliente]  = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [currentDocName, setCurrentDocName] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [templateAddSearch, setTemplateAddSearch] = useState("");
  const [documentActionMessage, setDocumentActionMessage] = useState("");
  const [changingDocuments, setChangingDocuments] = useState(false);
  const [associandoLegislacoes, setAssociandoLegislacoes] = useState(false);
  const [legislacaoMessage, setLegislacaoMessage] = useState("");
  const [referenciasNovas, setReferenciasNovas] = useState<ReferenciaNaoCadastrada[]>([]);
  const [referenciasNovasSelecionadas, setReferenciasNovasSelecionadas] = useState<Set<number>>(new Set());
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);

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
        setClienteProdutosInsumos(parseProdutosInsumos(pasta.clienteProdutosInsumos));
        const associadas = parseStringList(pasta.legislacaoIds);
        setSelectedLeg(associadas);
        if (!estado) return;
        const idsAssociadas = associadas.length > 0 ? `&ids=${encodeURIComponent(associadas.join(","))}` : "";
        return fetch(`/api/legislacoes?estado=${estado}${idsAssociadas}`)
          .then((r) => r.json())
          .then((legs: Legislacao[]) => {
            setLegislacoes(legs.filter((leg) => leg.ativo !== false));
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
          outputPath: null,
          equipamentosSelecionados: null,
          ...d,
        })) as Documento[];
        setDocs(normalized);

        // Restore previously saved assignments
        const init: Record<string, string> = {};
        normalized.forEach((d) => { if (d.templateId) init[d.id] = d.templateId; });
        setAssignments(init);

        const equipmentInit: Record<string, Equipamento[]> = {};
        const equipmentOpenInit: Record<string, boolean> = {};
        normalized.forEach((d) => {
          const equipamentos = parseEquipamentos(d.equipamentosSelecionados);
          equipmentInit[d.id] = equipamentos;
          Array.from(new Set(equipamentos.map(classificarMaterialGroup))).forEach((groupId) => {
            equipmentOpenInit[grupoAbertoKey(d.id, groupId)] = true;
          });
        });
        setEquipmentAssignments(equipmentInit);
        setEquipmentOptionsOpen(equipmentOpenInit);

        // Default: select pending docs. After editing customer data, preselect generated docs too
        // because they need regeneration to reflect the updated services/equipment/client data.
        setSelectedDocs(new Set(
          normalized
            .filter((d) => regenerarAposEdicao ? !!d.templateId : d.status === "pendente")
            .map((d) => d.id)
        ));
      });

    // 3. Fetch templates
    fetch("/api/templates")
      .then((r) => r.json())
      .then((ts: Template[]) =>
        setTemplates(ts.filter((t: Template & { ativo?: boolean }) => t.ativo !== false))
      );
  }, [id, regenerarAposEdicao]);

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

  function salvarLegislacoes(ids: string[]) {
    setSelectedLeg(ids);
    fetch(`/api/pastas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legislacaoIds: JSON.stringify(ids) }),
    }).catch(console.error);
  }

  async function visualizarDocumento(doc: Documento) {
    setPreview({ title: doc.nomeArquivo, html: "", loading: true });
    try {
      const response = await fetch(`/api/pastas/${id}/documentos/${doc.id}/preview`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar preview");
      setPreview({ title: doc.nomeArquivo, html: data.html || "", loading: false });
    } catch (error) {
      setPreview({
        title: doc.nomeArquivo,
        html: "",
        loading: false,
        error: error instanceof Error ? error.message : "Falha ao carregar preview",
      });
    }
  }

  async function associarLegislacoesDoArquivo() {
    setAssociandoLegislacoes(true);
    setLegislacaoMessage("");
    try {
      const response = await fetch(`/api/pastas/${id}/legislacoes/associar`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao reconhecer referências");
      const associadas = (data.legislacoes || []) as Legislacao[];
      setSelectedLeg(associadas.map((legislacao) => legislacao.id));
      setLegislacoes((current) => {
        const byId = new Map(current.map((legislacao) => [legislacao.id, legislacao]));
        associadas.forEach((legislacao) => byId.set(legislacao.id, legislacao));
        return Array.from(byId.values());
      });
      setLegislacaoMessage(
        associadas.length > 0
          ? `${associadas.length} referência(s) reconhecida(s) no Documento em Elaboração.`
          : "Nenhuma referência cadastrada foi reconhecida no Documento em Elaboração."
      );
    } catch (error) {
      setLegislacaoMessage(error instanceof Error ? error.message : "Erro ao reconhecer referências");
    } finally {
      setAssociandoLegislacoes(false);
    }
  }

  function toggleReferenciaNova(index: number) {
    setReferenciasNovasSelecionadas((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  async function buscarReferenciasNovasDoArquivo() {
    setAssociandoLegislacoes(true);
    setLegislacaoMessage("");
    setReferenciasNovas([]);
    setReferenciasNovasSelecionadas(new Set());
    try {
      const response = await fetch(`/api/pastas/${id}/legislacoes/associar`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao buscar referências novas");
      const novas = (data.referenciasNaoCadastradas || []) as ReferenciaNaoCadastrada[];
      const associadas = (data.legislacoes || []) as Legislacao[];
      setSelectedLeg(associadas.map((legislacao) => legislacao.id));
      setLegislacoes((current) => {
        const byId = new Map(current.map((legislacao) => [legislacao.id, legislacao]));
        associadas.forEach((legislacao) => byId.set(legislacao.id, legislacao));
        return Array.from(byId.values());
      });
      setReferenciasNovas(novas);
      setReferenciasNovasSelecionadas(new Set(novas.map((_, index) => index)));
      setLegislacaoMessage(
        `${associadas.length} referência(s) já cadastrada(s) associada(s). ${novas.length} nova(s) para revisar.`
      );
    } catch (error) {
      setLegislacaoMessage(error instanceof Error ? error.message : "Erro ao buscar referências novas");
    } finally {
      setAssociandoLegislacoes(false);
    }
  }

  async function adicionarReferenciasNovas() {
    const selecionadas = referenciasNovas.filter((_, index) => referenciasNovasSelecionadas.has(index));
    if (selecionadas.length === 0) return;

    setAssociandoLegislacoes(true);
    setLegislacaoMessage("");
    try {
      const adicionadas: Legislacao[] = [];
      for (const referencia of selecionadas) {
        const response = await fetch("/api/legislacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(referencia),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao adicionar referência.");
        adicionadas.push(data as Legislacao);
      }
      const novosIds = adicionadas.map((legislacao) => legislacao.id);
      setLegislacoes((current) => {
        const byId = new Map(current.map((legislacao) => [legislacao.id, legislacao]));
        adicionadas.forEach((legislacao) => byId.set(legislacao.id, legislacao));
        return Array.from(byId.values());
      });
      salvarLegislacoes(Array.from(new Set([...selectedLeg, ...novosIds])));
      setReferenciasNovas((current) => current.filter((_, index) => !referenciasNovasSelecionadas.has(index)));
      setReferenciasNovasSelecionadas(new Set());
      setLegislacaoMessage(`${adicionadas.length} referência(s) adicionada(s) à base e associada(s) à pasta.`);
    } catch (error) {
      setLegislacaoMessage(error instanceof Error ? error.message : "Erro ao adicionar referências.");
    } finally {
      setAssociandoLegislacoes(false);
    }
  }

  async function removeDocument(doc: Documento) {
    if (doc.outputPath && !window.confirm(
      `Remover "${doc.nomeArquivo}"? O arquivo já gerado será excluído e não aparecerá no ZIP final.`
    )) {
      return;
    }
    setChangingDocuments(true);
    setDocumentActionMessage("");
    try {
      const response = await fetch(`/api/pastas/${id}/documentos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao remover documento");
      setDocs((prev) => prev.filter((item) => item.id !== doc.id));
      setSelectedDocs((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      setEquipmentAssignments((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      setEquipmentOptionsOpen((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      setDocumentActionMessage("Documento removido da pasta.");
    } catch (error) {
      setDocumentActionMessage(error instanceof Error ? error.message : "Erro ao remover documento");
    } finally {
      setChangingDocuments(false);
    }
  }

  async function addDocumentFromTemplate(template: Template) {
    setChangingDocuments(true);
    setDocumentActionMessage("");
    try {
      const response = await fetch(`/api/pastas/${id}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, nomeArquivo: template.nome }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao adicionar documento");

      const novoDoc = {
        avisoRtNoCorpo: false,
        logoSubstituida: null,
        tokensUsados: null,
        mensagemErro: null,
        outputPath: null,
        equipamentosSelecionados: null,
        ...data,
      } as Documento;

      setDocs((prev) => [...prev, novoDoc]);
      setAssignments((prev) => ({ ...prev, [novoDoc.id]: template.id }));
      setSelectedDocs((prev) => new Set([...Array.from(prev), novoDoc.id]));
      setEquipmentAssignments((prev) => ({ ...prev, [novoDoc.id]: [] }));
      setTemplateAddSearch("");
      setDocumentActionMessage(`Documento "${novoDoc.nomeArquivo}" adicionado e selecionado para geracao.`);
    } catch (error) {
      setDocumentActionMessage(error instanceof Error ? error.message : "Erro ao adicionar documento");
    } finally {
      setChangingDocuments(false);
    }
  }

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
    setEquipmentAssignments((prev) => {
      // Replace only the "equipamento" group, preserving selections from other groups
      // (insumos, medicamentos, cosmeticos...) so suggesting equipment never wipes them.
      const atuais = (prev[doc.id] || []).filter((eq) => classificarMaterialGroup(eq) !== "equipamento");
      const next = [...atuais, ...sugeridos];
      salvarEquipamentosDoDoc(doc.id, next);
      return { ...prev, [doc.id]: next };
    });
  }

  // Remove every item belonging to a group from the doc's selection.
  function limparGrupoMateriais(docId: string, itensDoGrupo: Equipamento[]) {
    const remover = new Set(itensDoGrupo.map(equipamentoKey));
    setEquipmentAssignments((prev) => {
      const atuais = prev[docId] || [];
      const next = atuais.filter((eq) => !remover.has(equipamentoKey(eq)));
      salvarEquipamentosDoDoc(docId, next);
      return { ...prev, [docId]: next };
    });
  }

  function toggleMaterialGroup(doc: Documento, groupId: string, itensDoGrupo: Equipamento[], enabled: boolean) {
    setEquipmentOptionsOpen((prev) => ({ ...prev, [grupoAbertoKey(doc.id, groupId)]: enabled }));
    if (!enabled) limparGrupoMateriais(doc.id, itensDoGrupo);
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
        outputPath: null,
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
      const nextEquipmentOpen: Record<string, boolean> = {};
      normalized.forEach((doc) => {
        const equipamentos = parseEquipamentos(doc.equipamentosSelecionados);
        nextEquipment[doc.id] = equipamentos;
        Array.from(new Set(equipamentos.map(classificarMaterialGroup))).forEach((groupId) => {
          nextEquipmentOpen[grupoAbertoKey(doc.id, groupId)] = true;
        });
      });
      setEquipmentAssignments(nextEquipment);
      setEquipmentOptionsOpen(nextEquipmentOpen);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao preencher templates");
    } finally {
      setAutoFilling(false);
    }
  }

  async function handleGerar(ignorarJaGerados = false, docsOverride?: Documento[]) {
    const docsSelecionados = docsOverride ?? docs.filter((d) => selectedDocs.has(d.id) && assignments[d.id]);

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

    // Generate one document at a time. Each document is isolated in its own
    // try/catch so a failure on ONE document (e.g. a 504 timeout on a heavy
    // MBP/PGRSS) never aborts the whole batch — the loop marks that document as
    // "erro" and moves on to the next one. Previously a single non-JSON error
    // response (Vercel's "An error occurred" 504 page) threw on res.json() and
    // killed the entire run, leaving later documents ungenerated and the UI
    // silent.
    try {
      for (const doc of docsSelecionados) {
        setCurrentDocName(doc.nomeArquivo);

        let r: {
          id: string;
          status: string;
          error?: string;
          avisoRt?: boolean;
          logoSubstituida?: boolean;
          tokensUsados?: number;
          outputPath?: string;
        } | undefined;
        let erroDoc: string | null = null;

        try {
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

          // 3. Generate this document, with one automatic retry on transient
          //    gateway errors (502/503/504/408) — these are infra hiccups,
          //    not content problems, and recover on their own most of the
          //    time without needing the operator to notice and re-run it.
          const TRANSIENT_STATUS = [502, 503, 504, 408];
          let res: Response;
          let rawBody: string;
          let attempt = 0;
          while (true) {
            res = await fetch("/api/gerar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pastaId: id,
                documentoIds: [doc.id],
                legislacaoIds: selectedLeg,
              }),
            });
            rawBody = await res.text();
            if (res.ok || !TRANSIENT_STATUS.includes(res.status) || attempt >= 1) break;
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          // 4. Parse the response defensively. On a gateway timeout the body is
          //    an HTML/text error page, not JSON, so res.json() would throw.
          let result: { results?: unknown[] } | null = null;
          try {
            result = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            result = null;
          }

          if (!res.ok || !result) {
            erroDoc = TRANSIENT_STATUS.includes(res.status)
              ? `Tempo excedido ao gerar este documento${attempt > 0 ? " mesmo após nova tentativa" : ""} (provavelmente muito extenso). Tente gerá-lo sozinho.`
              : `Falha na geração (HTTP ${res.status}).`;
          } else {
            r = result.results?.[0] as typeof r;
            if (!r) erroDoc = "Resposta inválida do servidor.";
          }
        } catch (err) {
          // Network error / fetch aborted — record and continue with next doc.
          erroDoc = err instanceof Error ? err.message : "Erro de rede ao gerar o documento.";
        }

        // 5. Update this document's status and increment batch counter
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  status:          r?.status ?? "erro",
                  mensagemErro:    r?.error ?? erroDoc ?? null,
                  avisoRtNoCorpo:  r?.avisoRt ?? d.avisoRtNoCorpo,
                  logoSubstituida: r?.logoSubstituida ?? d.logoSubstituida,
                  tokensUsados:    r?.tokensUsados ?? d.tokensUsados,
                  outputPath:      r?.outputPath ?? d.outputPath,
                }
              : d
          )
        );
        setBatchDone((n) => n + 1);
      }
    } finally {
      // Always release the processing lock so the UI never freezes
      setProcessing(false);
      setCurrentDocName("");
      setDone(true);
    }
  }

  function regenerarComErro() {
    const comErro = docs.filter((d) => d.status === "erro" && assignments[d.id]);
    if (comErro.length === 0) return;
    setSelectedDocs(new Set(comErro.map((d) => d.id)));
    void handleGerar(true, comErro);
  }

  // â”€â”€ Derived values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gerados      = docs.filter((d) => d.status === "gerado").length;
  const erros        = docs.filter((d) => d.status === "erro").length;
  const total        = docs.length;
  const concluidos   = gerados + erros;
  const progress     = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const normalizedDocumentSearch = normalizeForMatch(documentSearch.trim());
  const docsFiltrados = normalizedDocumentSearch
    ? docs.filter((doc) => {
        const templateAtual = getTemplateAtual(doc, assignments, templates);
        const searchable = normalizeForMatch([
          doc.nomeArquivo,
          doc.status,
          doc.mensagemErro || "",
          templateAtual?.nome || "",
          templateAtual?.tipo || "",
        ].join(" "));
        return searchable.includes(normalizedDocumentSearch);
      })
    : docs;
  const visibleDocs = [...docsFiltrados].sort((a, b) => {
    const aGerado = a.status === "gerado" ? 1 : 0;
    const bGerado = b.status === "gerado" ? 1 : 0;
    if (aGerado !== bGerado) return aGerado - bGerado;
    return a.nomeArquivo.localeCompare(b.nomeArquivo, "pt-BR", { sensitivity: "base" });
  });
  const normalizedTemplateAddSearch = normalizeForMatch(templateAddSearch.trim());
  const templatesParaAdicionar = templates
    .filter((template) => {
      const templateKey = normalizeForMatch(`${template.nome} ${template.tipo}`);
      const jaExiste = docs.some((doc) =>
        doc.templateId === template.id ||
        normalizeForMatch(doc.nomeArquivo) === normalizeForMatch(template.nome)
      );
      return !jaExiste && (!normalizedTemplateAddSearch || templateKey.includes(normalizedTemplateAddSearch));
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
    .slice(0, 8);
  const prontoParaGerar = docs.filter((d) => selectedDocs.has(d.id) && assignments[d.id]).length;
  const totalTokens  = docs.reduce((s, d) => s + (d.tokensUsados ?? 0), 0);
  const custoUsd = docs.reduce((sum, d) => {
    const tokens = d.tokensUsados ?? 0;
    if (tokens === 0) return sum;
    const rate = d.template?.processingType === "SONNET_REQUIRED" ? USD_PER_TOKEN_SONNET : USD_PER_TOKEN;
    return sum + tokens * rate;
  }, 0);
  const custo        = formatCost(custoUsd);
  const lotePercent = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0;
  const elapsedSeconds = generationStartedAt ? Math.max(0, Math.round((now - generationStartedAt) / 1000)) : 0;
  const averageSeconds = batchDone > 0 ? elapsedSeconds / batchDone : 0;
  const remainingSeconds = processing && averageSeconds > 0
    ? Math.max(0, Math.round(averageSeconds * (batchTotal - batchDone)))
    : null;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="max-w-6xl mx-auto">
      <ScrollToTopButton />
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Gerar documentos</h1>
        <button
          onClick={() => { void handleGerar(); }}
          disabled={processing || prontoParaGerar === 0}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing
            ? `Gerando... ${batchDone}/${batchTotal}`
            : `Gerar ${prontoParaGerar} documento${prontoParaGerar !== 1 ? "s" : ""}`}
        </button>
      </div>

      {regenerarAposEdicao && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Os dados da pasta foram alterados. Documentos ja gerados foram pre-selecionados para regeracao, assim novos servicos, equipamentos ou dados do cliente entram no arquivo atualizado.
        </div>
      )}

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

        <div className="border-b border-gray-100 bg-blue-50/40 px-5 py-4">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Adicionar documento por template</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Use quando a cliente adicionou um servico depois do Documento em Elaboracao e o POP/documento nao entrou na lista inicial.
              </p>
            </div>
            <input
              type="search"
              value={templateAddSearch}
              onChange={(e) => setTemplateAddSearch(e.target.value)}
              disabled={processing || changingDocuments}
              placeholder="Buscar template ativo para adicionar..."
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            />
            {templateAddSearch.trim() && (
              <div className="flex flex-wrap gap-2">
                {templatesParaAdicionar.length > 0 ? (
                  templatesParaAdicionar.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => { void addDocumentFromTemplate(template); }}
                      disabled={processing || changingDocuments}
                      className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      + {template.nome}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">
                    Nenhum template ativo disponivel ou o documento ja esta na pasta.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {docs.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="sr-only" htmlFor="document-search">Pesquisar documentos</label>
              <input
                id="document-search"
                type="search"
                value={documentSearch}
                onChange={(e) => setDocumentSearch(e.target.value)}
                disabled={processing}
                placeholder="Pesquisar documentos..."
                className="w-full sm:max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
              <span className="text-xs text-gray-500">
                {visibleDocs.length} de {docs.length} documentos
              </span>
            </div>
          </div>
        )}

        {documentActionMessage && (
          <p className="px-5 py-3 border-b border-gray-100 bg-blue-50/40 text-xs text-blue-700">
            {documentActionMessage}
          </p>
        )}

        {docs.length === 0 && (
          <p className="px-5 py-6 text-gray-600 text-sm">Nenhum documento extraído.</p>
        )}

        {docs.length > 0 && visibleDocs.length === 0 && (
          <p className="px-5 py-6 text-gray-600 text-sm">Nenhum documento encontrado.</p>
        )}

        <ul className="divide-y divide-gray-100">
          {visibleDocs.map((doc) => {
            const isSelecionado = selectedDocs.has(doc.id);
            const jaGerado      = doc.status === "gerado";
            const templateAtual = getTemplateAtual(doc, assignments, templates);
            const isPop = isPopDocumento(doc, assignments, templates);
            const equipamentosDoc = equipmentAssignments[doc.id] || [];
            const equipamentosDocKeys = new Set(equipamentosDoc.map(equipamentoKey));
            const insumosMateriais = clienteProdutosInsumos.map(produtoInsumoToMaterial);
            const materialGroups = buildMaterialGroups(clienteEquipamentos, insumosMateriais);

            return (
              <li key={doc.id} className="px-5 py-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-start gap-3">
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
                  <span
                    className={`min-w-[18rem] flex-[1_1_28rem] whitespace-normal break-words text-sm leading-snug ${jaGerado && !isSelecionado ? "text-gray-400 line-through" : "text-gray-900"}`}
                    title={doc.nomeArquivo}
                  >
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
                    className="w-full max-w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-50 sm:w-[22rem] lg:w-[26rem] lg:shrink-0"
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
                  {doc.outputPath && (
                    <button
                      type="button"
                      onClick={() => { void visualizarDocumento(doc); }}
                      disabled={processing}
                      className="text-xs text-blue-600 hover:underline disabled:text-gray-400 shrink-0"
                    >
                      Visualizar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { void removeDocument(doc); }}
                    disabled={processing || changingDocuments}
                    className="text-xs text-red-500 hover:underline disabled:text-gray-400 shrink-0"
                  >
                    Remover
                  </button>
                </div>

                {/* Post-generation badges */}
                {false && jaGerado && (
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

                {isPop && materialGroups.length > 0 && (
                  <div className="ml-11 flex flex-col gap-2">
                    {materialGroups.map((grupo) => {
                      const grupoItensKeys = new Set(grupo.itens.map(equipamentoKey));
                      const selecionadosNoGrupo = equipamentosDoc.filter((eq) => grupoItensKeys.has(equipamentoKey(eq)));
                      const grupoAberto = !!equipmentOptionsOpen[grupoAbertoKey(doc.id, grupo.id)];
                      const labelLower = (MATERIAL_GROUP_LABEL[grupo.id] || grupo.label).toLowerCase();
                      return (
                        <div key={grupo.id}>
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={grupoAberto}
                              disabled={processing}
                              onChange={(e) => toggleMaterialGroup(doc, grupo.id, grupo.itens, e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                            />
                            <span>Especificar {labelLower} neste POP</span>
                            {selecionadosNoGrupo.length > 0 && (
                              <span className="text-slate-400">({selecionadosNoGrupo.length})</span>
                            )}
                          </label>

                          {grupoAberto && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-slate-700">{grupo.label} na seção de materiais</p>
                                <div className="flex gap-2 text-xs">
                                  {grupo.id === "equipamento" && (
                                    <button
                                      type="button"
                                      onClick={() => aplicarSugestaoEquipamentos(doc)}
                                      disabled={processing || !templateAtual}
                                      className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                                    >
                                      Sugerir
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => limparGrupoMateriais(doc.id, grupo.itens)}
                                    disabled={processing || selecionadosNoGrupo.length === 0}
                                    className="text-gray-500 hover:underline disabled:text-gray-400 disabled:no-underline"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              </div>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {grupo.itens.map((item) => {
                                  const key = equipamentoKey(item);
                                  return (
                                    <label key={key} className="flex items-start gap-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={equipamentosDocKeys.has(key)}
                                        disabled={processing}
                                        onChange={() => toggleEquipamentoDoc(doc.id, item)}
                                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                                      />
                                      <span>{equipamentoLabel(item)}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* â”€â”€ LegislaÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {(legislacoes.length > 0 || estadoCliente) && (
        <div className="bg-white border border-gray-200 rounded-xl mb-6 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">
              Legislações - {estadoCliente}
            </h2>
            <div className="flex gap-3 text-xs">
              <button
                onClick={() => { void associarLegislacoesDoArquivo(); }}
                disabled={processing || associandoLegislacoes}
                className="text-emerald-700 hover:underline disabled:text-gray-400"
              >
                {associandoLegislacoes ? "Reconhecendo..." : "Reconhecer do documento"}
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => { void buscarReferenciasNovasDoArquivo(); }}
                disabled={processing || associandoLegislacoes}
                className="text-amber-700 hover:underline disabled:text-gray-400"
              >
                Importar novas
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => salvarLegislacoes(legislacoes.map((l) => l.id))}
                className="text-blue-600 hover:underline"
              >
                Todas
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => salvarLegislacoes([])}
                className="text-gray-500 hover:underline"
              >
                Nenhuma
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {selectedLeg.length} de {legislacoes.length} associadas - a seleção inicial veio do Documento em Elaboração
          </p>
          {legislacaoMessage && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
              {legislacaoMessage}
            </p>
          )}
          {referenciasNovas.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <p className="text-xs font-semibold text-amber-900">
                  {referenciasNovasSelecionadas.size} de {referenciasNovas.length} referência(s) nova(s) selecionada(s)
                </p>
                <button
                  type="button"
                  onClick={() => { void adicionarReferenciasNovas(); }}
                  disabled={processing || associandoLegislacoes || referenciasNovasSelecionadas.size === 0}
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Adicionar à base e associar
                </button>
              </div>
              <ul className="divide-y divide-amber-100">
                {referenciasNovas.map((referencia, index) => (
                  <li key={`${referencia.referenciaAbnt}-${index}`} className="flex items-start gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={referenciasNovasSelecionadas.has(index)}
                      onChange={() => toggleReferenciaNova(index)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300 text-amber-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-950">{referencia.titulo}</p>
                      <p className="text-xs text-amber-800">
                        {referencia.tipo} · {referencia.estadoUf}
                        {referencia.municipio ? ` · ${referencia.municipio}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-amber-900">{referencia.referenciaAbnt}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            {legislacoes.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhuma legislação carregada para esta UF. Use &quot;Importar novas&quot; para buscar no Documento em Elaboração.
              </p>
            )}
            {legislacoes.map((leg) => (
              <label key={leg.id} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedLeg.includes(leg.id)}
                  onChange={(e) =>
                    salvarLegislacoes(
                      e.target.checked
                        ? Array.from(new Set([...selectedLeg, leg.id]))
                        : selectedLeg.filter((l) => l !== leg.id)
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
          {!processing && done && batchTotal > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span>
                Tempo de execução: <strong className="text-gray-800">{formatDuration(elapsedSeconds)}</strong> para {batchTotal} documento{batchTotal !== 1 ? "s" : ""}
              </span>
              {erros > 0 && (
                <button
                  type="button"
                  onClick={regenerarComErro}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  Regerar {erros} com erro
                </button>
              )}
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
              <span className="text-gray-400 ml-auto">(estimativa - Haiku ou Sonnet conforme o template)</span>
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
      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
