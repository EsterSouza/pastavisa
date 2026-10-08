"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { PastaHeader } from "@/components/pasta/PastaHeader";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Drawer } from "@/components/ui/Drawer";
import { fieldClass } from "@/components/ui/Field";
import { Card } from "@/components/ui/Surface";
import {
  DOCUMENTO_STATUS,
  describeErrorOrigin,
  Feedback,
  ProgressBar,
  StatusBadge,
  ToneMark,
  type Tone,
} from "@/components/ui/Status";
import { normalizeForMatch } from "@/components/ui/text";
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

// --- Token cost helpers -----------------------------------------------------
// Cada documento é cobrado pela taxa do modelo que o template usa (ver
// lib/classifier.ts modelForType); misturar tudo numa taxa Haiku subestimava
// vários documentos SONNET_REQUIRED (POP, TCLE, MBP, PGRSS...).
// Haiku:  US$ 0,80/M entrada + US$ 4,00/M saída  -> mistura ~= 1,76/M -> usa 2,00/M
// Sonnet: US$ 3,00/M entrada + US$ 15,00/M saída -> mistura ~= 6,60/M -> usa 7,00/M
const USD_PER_TOKEN = 2.0 / 1_000_000;
const USD_PER_TOKEN_SONNET = 7.0 / 1_000_000;
const BRL_PER_USD = 5.80; // taxa fixa aproximada

function formatCost(usd: number): { usd: string; brl: string } {
  const brl = usd * BRL_PER_USD;
  return {
    usd: usd < 0.01 ? "< US$ 0,01" : `~US$ ${usd.toFixed(2).replace(".", ",")}`,
    brl: brl < 0.05 ? "< R$ 0,05" : `~R$ ${brl.toFixed(2).replace(".", ",")}`,
  };
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

// --- Grupos de materiais ----------------------------------------------------
// Equipamentos e produtos da tabela de insumos são especificados em GRUPOS
// separados no POP, porque as tabelas vêm separadas no documento de planejamento.
const MATERIAL_GROUPS: Array<{ id: string; label: string }> = [
  { id: "equipamento", label: "Equipamentos" },
  { id: "insumo", label: "Insumos" },
  { id: "medicamento", label: "Medicamentos" },
  { id: "cosmetico", label: "Cosméticos" },
  { id: "saneante", label: "Saneantes" },
  { id: "produto", label: "Outros produtos" },
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

// Chave composta para guardar o aberto/fechado de cada grupo por documento.
function grupoAbertoKey(docId: string, groupId: string): string {
  return `${docId}::${groupId}`;
}

// Situação usada nos filtros e nos blocos da lista. "processando" conta como
// "a gerar": é o documento que está saindo agora.
type GrupoDoc = "erro" | "a-gerar" | "gerados";
type FiltroDocs = "todos" | GrupoDoc;

function grupoDoDocumento(doc: Documento): GrupoDoc {
  if (doc.status === "gerado") return "gerados";
  if (doc.status === "erro") return "erro";
  return "a-gerar";
}

const FILTROS_DOCS: Array<{ id: FiltroDocs; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "a-gerar", label: "A gerar" },
  { id: "erro", label: "Com erro" },
  { id: "gerados", label: "Gerados" },
];

// Colunas da lista: seleção, documento, situação, template, ações. Remover e
// Visualizar ficam no menu ⋯ para a linha nunca quebrar em duas.
const LINHA_GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_6.5rem_minmax(12rem,16rem)_2.75rem] items-center gap-3";

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

  const [docs, setDocs] = useState<Documento[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [legislacoes, setLegislacoes] = useState<Legislacao[]>([]);
  const [clienteEquipamentos, setClienteEquipamentos] = useState<Equipamento[]>([]);
  const [clienteProdutosInsumos, setClienteProdutosInsumos] = useState<ProdutoInsumo[]>([]);
  const [selectedLeg, setSelectedLeg] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [equipmentAssignments, setEquipmentAssignments] = useState<Record<string, Equipamento[]>>({});
  const [equipmentOptionsOpen, setEquipmentOptionsOpen] = useState<Record<string, boolean>>({});
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [confirmRegerar, setConfirmRegerar] = useState<string[]>([]);
  const [estadoCliente, setEstadoCliente] = useState("");
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillError, setAutoFillError] = useState("");
  const [currentDocName, setCurrentDocName] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [templateAddSearch, setTemplateAddSearch] = useState("");
  const [documentActionMessage, setDocumentActionMessage] = useState("");
  const [documentActionErro, setDocumentActionErro] = useState(false);
  const [changingDocuments, setChangingDocuments] = useState(false);
  const [associandoLegislacoes, setAssociandoLegislacoes] = useState(false);
  const [legislacaoMessage, setLegislacaoMessage] = useState("");
  const [legislacaoErro, setLegislacaoErro] = useState(false);
  const [referenciasNovas, setReferenciasNovas] = useState<ReferenciaNaoCadastrada[]>([]);
  const [referenciasNovasSelecionadas, setReferenciasNovasSelecionadas] = useState<Set<number>>(new Set());
  const [loadError, setLoadError] = useState("");
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);
  const [pastaInfo, setPastaInfo] = useState<{ nome: string | null; status: string; cidade: string | null } | null>(null);
  const [filtroDocs, setFiltroDocs] = useState<FiltroDocs>("todos");
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [materiaisAbertos, setMateriaisAbertos] = useState<Set<string>>(new Set());
  const [legislacoesAbertas, setLegislacoesAbertas] = useState(false);
  const [legislacaoSearch, setLegislacaoSearch] = useState("");
  const [associadasAoAbrir, setAssociadasAoAbrir] = useState<string[]>([]);
  const selecionarTodosRef = useRef<HTMLInputElement>(null);

  // Evita que o auto-preenchimento rode mais de uma vez.
  const autoAssigned = useRef(false);

  // --- Carga inicial --------------------------------------------------------
  useEffect(() => {
    // 1. Pasta (para a UF) -> legislações
    fetch(`/api/pastas/${id}`)
      .then((r) => r.json())
      .then((pasta) => {
        const estado = pasta.clienteEstado || "";
        setPastaInfo({
          nome: pasta.clienteNomeFantasia ?? null,
          status: pasta.status || "rascunho",
          cidade: pasta.clienteCidade ?? null,
        });
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
            // Uma resposta que não é lista significa erro do servidor (401,
            // 500): sem esta guarda a página quebrava calada num TypeError.
            if (!Array.isArray(legs)) {
              setLoadError("O banco não devolveu a lista de legislações desta UF.");
              return;
            }
            setLegislacoes(legs.filter((leg) => leg.ativo !== false));
          });
      })
      .catch(() => setLoadError("Não foi possível carregar os dados da pasta no banco."));

    // 2. Documentos
    fetch(`/api/pastas/${id}/documentos`)
      .then((r) => r.json())
      .then((data: Array<Partial<Documento> & { id: string; nomeArquivo: string; status: string }>) => {
        if (!Array.isArray(data)) {
          setLoadError("O banco não devolveu a lista de documentos desta pasta.");
          return;
        }
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

        // Restaura as escolhas já salvas
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

        // Padrão: seleciona os pendentes. Depois de editar o cadastro, os já
        // gerados também entram, porque precisam refletir os dados novos.
        setSelectedDocs(new Set(
          normalized
            .filter((d) => regenerarAposEdicao ? !!d.templateId : d.status === "pendente")
            .map((d) => d.id)
        ));
      });

    // 3. Templates
    fetch("/api/templates")
      .then((r) => r.json())
      .then((ts: Template[]) => {
        if (!Array.isArray(ts)) {
          setLoadError("O banco não devolveu o catálogo de templates.");
          return;
        }
        setTemplates(ts.filter((t: Template & { ativo?: boolean }) => t.ativo !== false));
      })
      .catch(() => setLoadError("Não foi possível carregar o catálogo de templates."));
  }, [id, regenerarAposEdicao]);

  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [processing]);

  // --- Auto-seleção de template, uma vez só ---------------------------------
  useEffect(() => {
    if (autoAssigned.current) return;
    if (docs.length === 0 || templates.length === 0) return;
    autoAssigned.current = true;

    const toSave: Array<{ docId: string; templateId: string }> = [];

    setAssignments((prev) => {
      const next = { ...prev };
      for (const doc of docs) {
        if (next[doc.id]) continue; // mantém o que já veio do banco
        const match = findBestTemplateMatch(doc.nomeArquivo, templates);
        if (match) {
          next[doc.id] = match.templateId;
          toSave.push({ docId: doc.id, templateId: match.templateId });
        }
      }
      return next;
    });

    // Persiste o que foi casado automaticamente, para sobreviver ao reload.
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

  // --- Seleção --------------------------------------------------------------
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

  function alternarMateriais(docId: string) {
    setMateriaisAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }

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
    setLegislacaoErro(false);
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
      setLegislacaoErro(true);
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
    setLegislacaoErro(false);
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
      setLegislacaoErro(true);
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
    setLegislacaoErro(false);
    try {
      const adicionadas: Legislacao[] = [];
      for (const referencia of selecionadas) {
        const response = await fetch("/api/legislacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(referencia),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "O banco recusou a referência.");
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
      setLegislacaoErro(true);
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
    setDocumentActionErro(false);
    try {
      const response = await fetch(`/api/pastas/${id}/documentos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "O banco recusou a remoção do documento.");
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
      setDocumentActionMessage(`"${doc.nomeArquivo}" removido da pasta.`);
    } catch (error) {
      setDocumentActionErro(true);
      setDocumentActionMessage(error instanceof Error ? error.message : "Erro ao remover documento");
    } finally {
      setChangingDocuments(false);
    }
  }

  async function addDocumentFromTemplate(template: Template) {
    setChangingDocuments(true);
    setDocumentActionMessage("");
    setDocumentActionErro(false);
    try {
      const response = await fetch(`/api/pastas/${id}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id, nomeArquivo: template.nome }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "O banco recusou o novo documento.");

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
      setDocumentActionMessage(`"${novoDoc.nomeArquivo}" adicionado e selecionado para geração.`);
    } catch (error) {
      setDocumentActionErro(true);
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
      // Substitui só o grupo "equipamento", preservando insumos, medicamentos e
      // cosméticos já escolhidos.
      const atuais = (prev[doc.id] || []).filter((eq) => classificarMaterialGroup(eq) !== "equipamento");
      const next = [...atuais, ...sugeridos];
      salvarEquipamentosDoDoc(doc.id, next);
      return { ...prev, [doc.id]: next };
    });
  }

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

  // --- Geração, um documento por vez ----------------------------------------
  async function autoPreencherTemplates() {
    setAutoFilling(true);
    setAutoFillError("");
    try {
      const response = await fetch(`/api/pastas/${id}/documentos/auto-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao preencher os templates");

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
      setAutoFillError(error instanceof Error ? error.message : "Erro ao preencher os templates");
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

    // Um documento por vez. Cada um isolado no seu try/catch: falha em UM
    // documento (por exemplo, 504 num MBP/PGRSS pesado) nunca aborta o lote —
    // aquele documento vira "erro" e o laço segue para o próximo.
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
          // 1. Grava a escolha de template
          await fetch(`/api/pastas/${id}/documentos`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docId: doc.id,
              templateId: assignments[doc.id],
              equipamentosSelecionados: JSON.stringify(equipmentAssignments[doc.id] || []),
            }),
          });

          // 2. Marca como processando (retorno imediato na tela)
          setDocs((prev) =>
            prev.map((d) => d.id === doc.id ? { ...d, status: "processando" } : d)
          );

          // 3. Gera este documento, com uma nova tentativa automática em erro
          //    transitório de gateway (502/503/504/408) — isso é soluço de
          //    infraestrutura, não problema de conteúdo.
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

          // 4. Interpreta a resposta com cautela: em timeout de gateway o corpo
          //    é uma página de erro, não JSON.
          let result: { results?: unknown[] } | null = null;
          try {
            result = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            result = null;
          }

          if (!res.ok || !result) {
            erroDoc = TRANSIENT_STATUS.includes(res.status)
              ? `Tempo excedido na geração deste documento${attempt > 0 ? ", mesmo após nova tentativa" : ""} (provavelmente muito extenso). Tente gerá-lo sozinho.`
              : `A geração falhou no servidor (HTTP ${res.status}).`;
          } else {
            r = result.results?.[0] as typeof r;
            if (!r) erroDoc = "A geração respondeu sem resultado para este documento.";
          }
        } catch (err) {
          // Erro de rede / fetch abortado — registra e segue para o próximo.
          erroDoc = err instanceof Error ? err.message : "Erro de rede na geração do documento.";
        }

        // 5. Atualiza o documento e o contador do lote
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  status: r?.status ?? "erro",
                  mensagemErro: r?.error ?? erroDoc ?? null,
                  avisoRtNoCorpo: r?.avisoRt ?? d.avisoRtNoCorpo,
                  logoSubstituida: r?.logoSubstituida ?? d.logoSubstituida,
                  tokensUsados: r?.tokensUsados ?? d.tokensUsados,
                  outputPath: r?.outputPath ?? d.outputPath,
                }
              : d
          )
        );
        setBatchDone((n) => n + 1);
      }
    } finally {
      // Sempre libera a trava, para a tela nunca congelar.
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

  // --- Derivados ------------------------------------------------------------
  const gerados = docs.filter((d) => d.status === "gerado").length;
  const erros = docs.filter((d) => d.status === "erro").length;
  const total = docs.length;
  const concluidos = gerados + erros;
  const progress = total > 0 ? Math.round((concluidos / total) * 100) : 0;
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
  const semTemplate = docs.filter((d) => selectedDocs.has(d.id) && !assignments[d.id]).length;
  const totalTokens = docs.reduce((s, d) => s + (d.tokensUsados ?? 0), 0);
  const custoUsd = docs.reduce((sum, d) => {
    const tokens = d.tokensUsados ?? 0;
    if (tokens === 0) return sum;
    const rate = d.template?.processingType === "SONNET_REQUIRED" ? USD_PER_TOKEN_SONNET : USD_PER_TOKEN;
    return sum + tokens * rate;
  }, 0);
  const custo = formatCost(custoUsd);
  const lotePercent = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0;
  const elapsedSeconds = generationStartedAt ? Math.max(0, Math.round((now - generationStartedAt) / 1000)) : 0;
  const averageSeconds = batchDone > 0 ? elapsedSeconds / batchDone : 0;
  const remainingSeconds = processing && averageSeconds > 0
    ? Math.max(0, Math.round(averageSeconds * (batchTotal - batchDone)))
    : null;

  const barraStatus = processing
    ? "Gerando"
    : total > 0 && concluidos === total
    ? erros > 0 ? "Concluído com erros" : "Concluído"
    : erros > 0 ? "Com erros" : "Pendente";
  const barraTone = processing ? "info" : erros > 0 ? "atencao" : total > 0 && concluidos === total ? "sucesso" : "neutro";

  // ZIP disponível sempre que houver documento gerado; com parte dos gerados
  // selecionada, baixa só essa parte.
  const selectedGeradosIds = docs.filter((d) => d.status === "gerado" && selectedDocs.has(d.id)).map((d) => d.id);
  const downloadParcial = selectedGeradosIds.length > 0 && selectedGeradosIds.length < gerados;
  const download = gerados === 0
    ? null
    : downloadParcial
    ? { url: `/api/pastas/${id}/download?ids=${selectedGeradosIds.join(",")}`, label: `Baixar ZIP (${selectedGeradosIds.length} selecionados)` }
    : { url: `/api/pastas/${id}/download`, label: `Baixar ZIP (${gerados} documentos)` };

  // A lista fica em blocos recolhíveis: erros primeiro, depois o que falta
  // gerar (ambos abertos) e o que já foi gerado (fechado). Com busca ativa ou
  // filtro em Gerados, o último também abre.
  const buscandoDocs = normalizedDocumentSearch.length > 0;
  const contagemFiltro: Record<FiltroDocs, number> = {
    todos: visibleDocs.length,
    erro: visibleDocs.filter((d) => grupoDoDocumento(d) === "erro").length,
    "a-gerar": visibleDocs.filter((d) => grupoDoDocumento(d) === "a-gerar").length,
    gerados: visibleDocs.filter((d) => grupoDoDocumento(d) === "gerados").length,
  };
  const docsDaLista = filtroDocs === "todos"
    ? visibleDocs
    : visibleDocs.filter((d) => grupoDoDocumento(d) === filtroDocs);
  const gruposDocs = ([
    { id: "erro", titulo: "Com erro", aberto: true },
    { id: "a-gerar", titulo: "A gerar", aberto: true },
    { id: "gerados", titulo: "Já gerados", aberto: buscandoDocs || filtroDocs === "gerados" },
  ] as Array<{ id: GrupoDoc; titulo: string; aberto: boolean }>)
    .map((g) => ({ ...g, docs: docsDaLista.filter((d) => grupoDoDocumento(d) === g.id) }))
    .filter((g) => g.docs.length > 0);

  const visiveisSelecionados = docsDaLista.filter((d) => selectedDocs.has(d.id)).length;
  const todosVisiveisSelecionados = docsDaLista.length > 0 && visiveisSelecionados === docsDaLista.length;
  useEffect(() => {
    if (selecionarTodosRef.current) {
      selecionarTodosRef.current.indeterminate = visiveisSelecionados > 0 && !todosVisiveisSelecionados;
    }
  }, [visiveisSelecionados, todosVisiveisSelecionados]);

  function alternarTodosVisiveis() {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      docsDaLista.forEach((d) => {
        if (todosVisiveisSelecionados) next.delete(d.id); else next.add(d.id);
      });
      return next;
    });
  }

  const insumosMateriais = clienteProdutosInsumos.map(produtoInsumoToMaterial);
  const materialGroups = buildMaterialGroups(clienteEquipamentos, insumosMateriais);
  const legislacoesAssociadas = legislacoes.filter((leg) => selectedLeg.includes(leg.id));
  const normalizedLegislacaoSearch = normalizeForMatch(legislacaoSearch.trim());
  // No painel, as associadas vêm primeiro: são as que importam conferir. A ordem
  // é a do momento em que o painel abriu, para a linha não pular ao marcar.
  const legislacoesVisiveis = (normalizedLegislacaoSearch
    ? legislacoes.filter((leg) =>
        normalizeForMatch(`${leg.titulo} ${leg.tipo} ${leg.estadoUf} ${leg.municipio || ""}`).includes(normalizedLegislacaoSearch)
      )
    : legislacoes
  ).slice().sort((a, b) => Number(associadasAoAbrir.includes(b.id)) - Number(associadasAoAbrir.includes(a.id)));
  const regerarSelecionados = docs.filter((d) => d.status === "gerado" && selectedDocs.has(d.id) && assignments[d.id]).length;

  // "Antes de gerar": o que pode sair errado no lote, numa lista só, no lugar
  // dos avisos espalhados pela página.
  const conferencias: Array<{ tone: Tone; texto: ReactNode }> = [];
  if (templates.length === 0) {
    conferencias.push({
      tone: "atencao",
      texto: <>Nenhum template ativo. Cadastre em <Link href="/templates" className="underline">Templates</Link>.</>,
    });
  }
  if (semTemplate > 0) {
    conferencias.push({ tone: "atencao", texto: `${semTemplate} selecionado(s) sem template ficam fora da geração.` });
  }
  if (regerarSelecionados > 0) {
    conferencias.push({ tone: "atencao", texto: `${regerarSelecionados} já gerado(s) selecionado(s) vão ser regerados.` });
  }
  if (erros > 0) {
    conferencias.push({ tone: "erro", texto: `${erros} com erro. Use "Regerar com erro" na barra acima.` });
  }
  if (!estadoCliente) {
    conferencias.push({ tone: "atencao", texto: "Pasta sem UF: as legislações estaduais não carregam." });
  } else if (selectedLeg.length === 0) {
    conferencias.push({ tone: "atencao", texto: "Nenhuma legislação associada à pasta." });
  }
  if (conferencias.length === 0) {
    conferencias.push({
      tone: "sucesso",
      texto: prontoParaGerar > 0 ? `Tudo certo para gerar ${prontoParaGerar} documento(s).` : "Nada pendente para gerar.",
    });
  }

  const rotuloGerar = processing
    ? `Gerando ${batchDone} de ${batchTotal}...`
    : prontoParaGerar === 0
    ? "Selecione um documento com template"
    : `Gerar ${prontoParaGerar} documento${prontoParaGerar !== 1 ? "s" : ""}`;

  return (
    <div className="mx-auto max-w-[80rem]">
      <ScrollToTopButton />

      <PastaHeader
        id={id}
        nome={pastaInfo ? pastaInfo.nome : undefined}
        status={pastaInfo?.status}
        meta={[
          [pastaInfo?.cidade, estadoCliente].filter(Boolean).join(" / "),
          `${total} documento${total !== 1 ? "s" : ""}`,
        ].filter(Boolean).join(" · ")}
      />

      <div aria-live="polite">
        {loadError && (
          <Feedback tone="erro" title={describeErrorOrigin(loadError).rotulo} className="mb-4">
            {loadError} Atualize a página para tentar novamente.
          </Feedback>
        )}
      </div>

      {regenerarAposEdicao && (
        <Feedback tone="atencao" title="Os dados da pasta mudaram" className="mb-4">
          Os documentos já gerados foram pré-selecionados para regeração, assim os novos serviços,
          equipamentos e dados do cliente entram nos arquivos atualizados.
        </Feedback>
      )}

      {/* Barra de ações fixa: progresso, Gerar e Baixar ZIP ficam visíveis em
          qualquer ponto da rolagem. O fundo cobre o conteúdo que passa por baixo. */}
      <div className="sticky top-0 z-popover -mx-2 mb-5 bg-surface-page px-2 pb-2 pt-3">
        <Card className="p-4 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div aria-live="polite" className="flex min-w-[18rem] flex-1 items-center gap-3">
              <StatusBadge tone={barraTone}>{barraStatus}</StatusBadge>
              <p className="text-sm text-ink">
                {processing ? (
                  <>
                    <strong>{batchDone} de {batchTotal}</strong> documentos do lote · {lotePercent}%
                  </>
                ) : (
                  <>
                    <strong>{gerados} de {total} gerado(s)</strong>
                    <span className="text-ink-muted">
                      {erros ? ` · ${erros} com erro` : ""} · {progress}% da pasta
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!processing && erros > 0 && (
                <Button variant="secondary" onClick={regenerarComErro}>
                  Regerar {erros} com erro
                </Button>
              )}
              <Button
                disabled={processing || prontoParaGerar === 0}
                onClick={() => {
                  void handleGerar();
                }}
              >
                {rotuloGerar}
              </Button>
              {download && (
                processing ? (
                  <span className={`${buttonClass("secondary")} pointer-events-none opacity-50`} aria-disabled="true">
                    {download.label}
                  </span>
                ) : (
                  <a href={download.url} className={buttonClass("secondary")}>
                    {download.label}
                  </a>
                )
              )}
            </div>
          </div>

          <div className="mt-3">
            <ProgressBar
              value={processing ? lotePercent : progress}
              label={processing ? "Progresso do lote" : "Progresso da pasta"}
              tone={barraTone === "neutro" ? "info" : barraTone}
            />
          </div>

          {processing && (
            <dl className="mt-3 grid gap-2 text-sm text-ink-muted sm:grid-cols-3">
              <div>
                <dt className="inline">Documento atual: </dt>
                <dd className="inline font-semibold text-ink">{currentDocName || "preparando..."}</dd>
              </div>
              <div>
                <dt className="inline">Decorrido: </dt>
                <dd className="inline font-semibold text-ink">{formatDuration(elapsedSeconds)}</dd>
              </div>
              <div>
                <dt className="inline">Restante: </dt>
                <dd className="inline font-semibold text-ink">
                  {remainingSeconds === null ? "calculando..." : formatDuration(remainingSeconds)}
                </dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-label="Documentos" className="min-w-0 rounded-lg border border-gray-200 bg-surface-card">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-[14rem] flex-[1_1_16rem]">
              <label className="sr-only" htmlFor="document-search">
                Buscar documento ou template
              </label>
              <input
                id="document-search"
                type="search"
                value={documentSearch}
                onChange={(e) => setDocumentSearch(e.target.value)}
                disabled={processing}
                placeholder="Buscar documento ou template"
                className={fieldClass}
              />
            </div>
            <div role="group" aria-label="Filtrar por situação" className="order-last flex basis-full flex-wrap gap-1.5">
              {FILTROS_DOCS.map((filtro) => {
                const ativo = filtroDocs === filtro.id;
                return (
                  <button
                    key={filtro.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltroDocs(filtro.id)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
                      ativo
                        ? "border-brand-action bg-brand-action text-brand-on-dark"
                        : "border-gray-300 bg-surface-card text-ink-muted hover:bg-surface-subtle hover:text-ink"
                    }`}
                  >
                    {filtro.label}
                    <span className={ativo ? "" : "text-ink-subtle"}>{contagemFiltro[filtro.id]}</span>
                  </button>
                );
              })}
            </div>
            <Button variant="quiet" disabled={processing || autoFilling} onClick={autoPreencherTemplates}>
              {autoFilling ? "Preenchendo..." : "Auto preencher"}
            </Button>
            <Button
              variant="secondary"
              aria-expanded={adicionarAberto}
              aria-controls="adicionar-documento"
              disabled={processing}
              onClick={() => setAdicionarAberto((v) => !v)}
            >
              {adicionarAberto ? "Fechar" : "+ Adicionar documento"}
            </Button>
          </div>

          {adicionarAberto && (
            <div id="adicionar-documento" className="border-t border-gray-200 bg-surface-subtle px-4 py-3">
              <label htmlFor="template-add" className="text-sm font-semibold text-ink">
                Adicionar documento por template
              </label>
              <p id="template-add-hint" className="text-sm text-ink-muted">
                Para quando a cliente contratou um serviço depois do Documento em Elaboração e o POP não
                entrou na lista inicial.
              </p>
              <input
                id="template-add"
                type="search"
                autoFocus
                value={templateAddSearch}
                aria-describedby="template-add-hint"
                onChange={(e) => setTemplateAddSearch(e.target.value)}
                disabled={processing || changingDocuments}
                placeholder="Digite parte do nome do template"
                className={`${fieldClass} mt-2`}
              />
              {templateAddSearch.trim() && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {templatesParaAdicionar.length > 0 ? (
                    templatesParaAdicionar.map((template) => (
                      <Button
                        key={template.id}
                        variant="secondary"
                        disabled={processing || changingDocuments}
                        onClick={() => {
                          void addDocumentFromTemplate(template);
                        }}
                      >
                        + {template.nome}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-ink-muted">
                      Nenhum template ativo disponível, ou o documento já está na pasta.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div aria-live="polite">
            {autoFillError && (
              <div className="border-t border-gray-200 px-4 py-3">
                <Feedback tone="erro" title={describeErrorOrigin(autoFillError).rotulo}>
                  {autoFillError}
                </Feedback>
              </div>
            )}
            {documentActionMessage && (
              <div className="border-t border-gray-200 px-4 py-3">
                <Feedback
                  tone={documentActionErro ? "erro" : "info"}
                  title={documentActionErro ? describeErrorOrigin(documentActionMessage).rotulo : undefined}
                >
                  {documentActionMessage}
                </Feedback>
              </div>
            )}
          </div>

          {docs.length > 0 && (
            <div
              className={`${LINHA_GRID} border-y border-gray-200 bg-surface-subtle px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted`}
            >
              <label className="-m-3 flex cursor-pointer p-3">
                <input
                  ref={selecionarTodosRef}
                  type="checkbox"
                  checked={todosVisiveisSelecionados}
                  disabled={processing || docsDaLista.length === 0}
                  onChange={alternarTodosVisiveis}
                  aria-label="Selecionar todos os documentos da lista"
                  className="h-4 w-4 rounded border-gray-300"
                />
              </label>
              <span aria-live="polite">Documento · {selectedDocs.size} selecionado(s)</span>
              <span>Situação</span>
              <span>Template</span>
              <span className="sr-only">Ações</span>
            </div>
          )}

          {docs.length === 0 && (
            <p className="border-t border-gray-200 px-4 py-6 text-sm text-ink-muted">
              Nenhum documento nesta pasta. Use <strong>+ Adicionar documento</strong> para incluir o primeiro.
            </p>
          )}

          {docs.length > 0 && docsDaLista.length === 0 && (
            <p className="px-4 py-6 text-sm text-ink-muted">
              Nenhum documento {buscandoDocs ? "encontrado para essa busca" : "nesta situação"}.
            </p>
          )}

          {gruposDocs.map((grupoDocs) => {
            const selecionadosNoBloco = grupoDocs.docs.filter((d) => selectedDocs.has(d.id)).length;
            return (
              <details key={grupoDocs.id} open={grupoDocs.aberto || undefined} className="group border-b border-gray-200 last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-subtle [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true" className="inline-block w-3 text-ink-muted transition-transform group-open:rotate-90">
                    ›
                  </span>
                  {grupoDocs.titulo}
                  <span className="font-normal text-ink-muted">
                    {grupoDocs.docs.length} documento{grupoDocs.docs.length !== 1 ? "s" : ""} · {selecionadosNoBloco} selecionado(s)
                  </span>
                </summary>
                <ul className="divide-y divide-gray-200 border-t border-gray-200">
                  {grupoDocs.docs.map((doc) => {
                    const isSelecionado = selectedDocs.has(doc.id);
                    const jaGerado = doc.status === "gerado";
                    const templateAtual = getTemplateAtual(doc, assignments, templates);
                    const docStatus = DOCUMENTO_STATUS[doc.status] || DOCUMENTO_STATUS.pendente;
                    const isPop = isPopDocumento(doc, assignments, templates);
                    const equipamentosDoc = equipmentAssignments[doc.id] || [];
                    const equipamentosDocKeys = new Set(equipamentosDoc.map(equipamentoKey));
                    const temMateriais = isPop && materialGroups.length > 0;
                    const materiaisVisiveis = temMateriais && materiaisAbertos.has(doc.id);
                    const detalhes = [
                      templateAtual?.tipo,
                      doc.tokensUsados ? `${doc.tokensUsados.toLocaleString("pt-BR")} tokens` : "",
                    ].filter(Boolean).join(" · ");

                    return (
                      <li key={doc.id} className="px-4 py-2.5">
                        <div className={LINHA_GRID}>
                          {/* O padding leva o alvo de clique a 44px (docs/DESIGN.md); a margem
                              negativa devolve o espaco, entao nada se move na tela. */}
                          <label className="-m-3 flex shrink-0 cursor-pointer p-3">
                            <input
                              type="checkbox"
                              checked={isSelecionado}
                              disabled={processing}
                              onChange={() => toggleDoc(doc.id)}
                              aria-label={`Selecionar ${doc.nomeArquivo}`}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </label>

                          <div className="min-w-0">
                            <p
                              className={`break-words text-sm font-semibold leading-snug ${
                                jaGerado && !isSelecionado ? "text-ink-muted" : "text-ink"
                              }`}
                            >
                              {doc.nomeArquivo}
                            </p>
                            {(detalhes || temMateriais) && (
                              <p className="mt-0.5 text-sm text-ink-muted">
                                {detalhes}
                                {detalhes && temMateriais && " · "}
                                {temMateriais && (
                                  <button
                                    type="button"
                                    aria-expanded={materiaisVisiveis}
                                    aria-controls={`materiais-${doc.id}`}
                                    onClick={() => alternarMateriais(doc.id)}
                                    className="font-semibold text-brand-accent underline-offset-4 hover:underline"
                                  >
                                    {equipamentosDoc.length > 0
                                      ? `${equipamentosDoc.length} materia${equipamentosDoc.length !== 1 ? "is" : "l"} especificado${equipamentosDoc.length !== 1 ? "s" : ""}`
                                      : "Especificar materiais"}
                                  </button>
                                )}
                              </p>
                            )}
                          </div>

                          <div>
                            <StatusBadge tone={docStatus.tone}>{docStatus.label}</StatusBadge>
                          </div>

                          <div>
                            <label className="sr-only" htmlFor={`template-${doc.id}`}>
                              Template de {doc.nomeArquivo}
                            </label>
                            <select
                              id={`template-${doc.id}`}
                              value={assignments[doc.id] ?? ""}
                              onChange={(e) => {
                                const templateId = e.target.value;
                                setAssignments((prev) => ({ ...prev, [doc.id]: templateId }));
                                // Persiste na hora, para sobreviver ao reload.
                                fetch(`/api/pastas/${id}/documentos`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ docId: doc.id, templateId: templateId || null }),
                                }).catch(console.error);
                              }}
                              disabled={processing}
                              className={`${fieldClass} ${assignments[doc.id] ? "" : "text-ink-muted"}`}
                            >
                              <option value="">Escolher template…</option>
                              {[...templates]
                                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
                                .map((t) => (
                                  <option key={t.id} value={t.id}>{t.nome}</option>
                                ))}
                            </select>
                          </div>

                          <ActionMenu
                            label={`Mais ações de ${doc.nomeArquivo}`}
                            disabled={processing}
                            items={[
                              ...(doc.outputPath
                                ? [{ label: "Visualizar", onSelect: () => { void visualizarDocumento(doc); } }]
                                : []),
                              ...(temMateriais
                                ? [{ label: materiaisVisiveis ? "Ocultar materiais" : "Especificar materiais", onSelect: () => alternarMateriais(doc.id) }]
                                : []),
                              {
                                label: "Remover da pasta",
                                destrutiva: true,
                                disabled: changingDocuments,
                                onSelect: () => { void removeDocument(doc); },
                              },
                            ]}
                          />
                        </div>

                        {(doc.mensagemErro || (!assignments[doc.id] && isSelecionado) || (jaGerado && (isSelecionado || doc.logoSubstituida === false || doc.avisoRtNoCorpo))) && (
                          <div className="ml-10 mr-14 mt-1 space-y-0.5">
                            {doc.mensagemErro && (
                              <p className="text-sm text-status-danger">
                                <span className="font-semibold">{describeErrorOrigin(doc.mensagemErro).rotulo}:</span>{" "}
                                {doc.mensagemErro}
                              </p>
                            )}
                            {!assignments[doc.id] && isSelecionado && (
                              <p className="text-sm text-status-warning">
                                Sem template escolhido — fica fora da geração.
                              </p>
                            )}
                            {jaGerado && isSelecionado && (
                              <p className="text-sm text-status-warning">Selecionado: vai ser regerado.</p>
                            )}
                            {jaGerado && doc.logoSubstituida === false && (
                              <p className="text-sm text-status-warning">
                                Logo da cliente não substituída no cabeçalho.
                              </p>
                            )}
                            {jaGerado && doc.avisoRtNoCorpo && (
                              <p className="text-sm text-status-warning">
                                Cita o responsável técnico no corpo. Confira antes de entregar.
                              </p>
                            )}
                          </div>
                        )}

                        {materiaisVisiveis && (
                          <div
                            id={`materiais-${doc.id}`}
                            className="ml-10 mr-14 mt-2 flex flex-col gap-2 rounded-md border border-gray-200 bg-surface-subtle px-3 py-3"
                          >
                            {materialGroups.map((grupo) => {
                              const grupoItensKeys = new Set(grupo.itens.map(equipamentoKey));
                              const selecionadosNoGrupo = equipamentosDoc.filter((eq) => grupoItensKeys.has(equipamentoKey(eq)));
                              const grupoAberto = !!equipmentOptionsOpen[grupoAbertoKey(doc.id, grupo.id)];
                              const labelLower = (MATERIAL_GROUP_LABEL[grupo.id] || grupo.label).toLowerCase();
                              return (
                                <div key={grupo.id}>
                                  <label className="inline-flex items-center gap-2 text-sm text-ink">
                                    <input
                                      type="checkbox"
                                      checked={grupoAberto}
                                      disabled={processing}
                                      onChange={(e) => toggleMaterialGroup(doc, grupo.id, grupo.itens, e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <span>
                                      Especificar {labelLower} neste POP
                                      {selecionadosNoGrupo.length > 0 ? ` (${selecionadosNoGrupo.length})` : ""}
                                    </span>
                                  </label>

                                  {grupoAberto && (
                                    <div className="mt-2 rounded-md border border-gray-200 bg-surface-card px-3 py-3">
                                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-ink">
                                          {grupo.label} na seção de materiais
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {grupo.id === "equipamento" && (
                                            <Button
                                              variant="quiet"
                                              disabled={processing || !templateAtual}
                                              onClick={() => aplicarSugestaoEquipamentos(doc)}
                                            >
                                              Sugerir
                                            </Button>
                                          )}
                                          <Button
                                            variant="quiet"
                                            disabled={processing || selecionadosNoGrupo.length === 0}
                                            onClick={() => limparGrupoMateriais(doc.id, grupo.itens)}
                                          >
                                            Limpar
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid gap-1.5 sm:grid-cols-2">
                                        {grupo.itens.map((item) => {
                                          const key = equipamentoKey(item);
                                          return (
                                            <label key={key} className="flex items-start gap-2 text-sm text-ink-muted">
                                              <input
                                                type="checkbox"
                                                checked={equipamentosDocKeys.has(key)}
                                                disabled={processing}
                                                onChange={() => toggleEquipamentoDoc(doc.id, item)}
                                                className="mt-0.5 h-4 w-4 rounded border-gray-300"
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
              </details>
            );
          })}
        </section>

        <aside aria-label="Conferência da pasta" className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base text-ink">Legislações</h2>
              <StatusBadge tone={selectedLeg.length > 0 ? "sucesso" : "atencao"}>
                {selectedLeg.length} de {legislacoes.length}
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {estadoCliente
                ? `Federais e de ${estadoCliente}. As associadas entram nas referências de todos os documentos.`
                : "Preencha a UF nos dados da cliente para carregar as legislações."}
            </p>
            {legislacoesAssociadas.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-ink">
                {legislacoesAssociadas.slice(0, 3).map((leg) => (
                  <li key={leg.id} className="line-clamp-2">
                    {leg.titulo}
                    <span className="text-ink-muted">{leg.estadoUf === "BR" ? " · Federal" : ` · ${leg.estadoUf}`}</span>
                  </li>
                ))}
                {legislacoesAssociadas.length > 3 && (
                  <li className="text-ink-muted">+ {legislacoesAssociadas.length - 3} referências</li>
                )}
              </ul>
            )}
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => {
                setAssociadasAoAbrir(selectedLeg);
                setLegislacoesAbertas(true);
              }}
            >
              Revisar legislações
            </Button>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Antes de gerar</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink">
              {conferencias.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <ToneMark tone={item.tone} />
                  <span>{item.texto}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Custo desta pasta</h2>
            {totalTokens > 0 ? (
              <>
                <p className="mt-2 text-2xl font-bold text-ink">{custo.brl}</p>
                <p className="text-sm text-ink-muted">
                  {custo.usd} · {totalTokens.toLocaleString("pt-BR")} tokens · estimativa por template
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Nenhum documento gerado ainda.</p>
            )}
            {!processing && done && batchTotal > 0 && (
              <p className="mt-2 text-sm text-ink-muted">
                Último lote: <strong className="text-ink">{formatDuration(elapsedSeconds)}</strong> para{" "}
                {batchTotal} documento{batchTotal !== 1 ? "s" : ""}.
              </p>
            )}
          </Card>
        </aside>
      </div>

      <Drawer
        aberto={legislacoesAbertas}
        titulo={`Legislações${estadoCliente ? ` — ${estadoCliente}` : ""}`}
        descricao={`${selectedLeg.length} de ${legislacoes.length} associadas. A seleção inicial veio do Documento em Elaboração.`}
        onClose={() => setLegislacoesAbertas(false)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={processing || associandoLegislacoes}
            onClick={() => {
              void associarLegislacoesDoArquivo();
            }}
          >
            {associandoLegislacoes ? "Reconhecendo..." : "Reconhecer do documento"}
          </Button>
          <Button
            variant="quiet"
            disabled={processing || associandoLegislacoes}
            onClick={() => {
              void buscarReferenciasNovasDoArquivo();
            }}
          >
            Importar novas
          </Button>
          <span className="flex-1" />
          <Button variant="quiet" onClick={() => salvarLegislacoes(legislacoes.map((l) => l.id))}>
            Todas
          </Button>
          <Button variant="quiet" onClick={() => salvarLegislacoes([])}>
            Nenhuma
          </Button>
        </div>

        <div aria-live="polite">
          {legislacaoMessage && (
            <Feedback
              tone={legislacaoErro ? "erro" : "info"}
              title={legislacaoErro ? describeErrorOrigin(legislacaoMessage).rotulo : undefined}
              className="mt-4"
            >
              {legislacaoMessage}
            </Feedback>
          )}
        </div>

        {referenciasNovas.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-surface-subtle px-3 py-2">
              <p className="text-sm font-semibold text-ink">
                {referenciasNovasSelecionadas.size} de {referenciasNovas.length} referência(s) nova(s)
                selecionada(s)
              </p>
              <Button
                disabled={processing || associandoLegislacoes || referenciasNovasSelecionadas.size === 0}
                onClick={() => {
                  void adicionarReferenciasNovas();
                }}
              >
                Adicionar à base e associar
              </Button>
            </div>
            <ul className="divide-y divide-gray-200">
              {referenciasNovas.map((referencia, index) => (
                <li key={`${referencia.referenciaAbnt}-${index}`} className="px-3 py-2">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={referenciasNovasSelecionadas.has(index)}
                      onChange={() => toggleReferenciaNova(index)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{referencia.titulo}</span>
                      <span className="block text-sm text-ink-muted">
                        {referencia.tipo} · {referencia.estadoUf}
                        {referencia.municipio ? ` · ${referencia.municipio}` : ""}
                      </span>
                      <span className="mt-1 block text-sm text-ink-muted">{referencia.referenciaAbnt}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {legislacoes.length > 0 && (
          <div className="mt-4">
            <label className="sr-only" htmlFor="legislacao-search">
              Buscar legislação
            </label>
            <input
              id="legislacao-search"
              type="search"
              value={legislacaoSearch}
              onChange={(e) => setLegislacaoSearch(e.target.value)}
              placeholder="Buscar por título, tipo ou município"
              className={fieldClass}
            />
          </div>
        )}

        {legislacoes.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Nenhuma legislação carregada para esta UF. Use <strong>Importar novas</strong> para
            buscar no Documento em Elaboração.
          </p>
        ) : legislacoesVisiveis.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Nenhuma legislação encontrada para essa busca.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-200">
            {legislacoesVisiveis.map((leg) => (
              <li key={leg.id}>
                <label className="flex cursor-pointer items-start gap-3 py-2.5">
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
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{leg.titulo}</span>
                    <span className="block text-sm text-ink-muted">
                      {leg.tipo}
                      {leg.estadoUf === "BR" ? " · Federal" : ` · ${leg.estadoUf}`}
                      {leg.municipio ? ` · ${leg.municipio}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Drawer>

      {confirmRegerar.length > 0 && (
        <ConfirmDialog
          title="Regerar documentos?"
          confirmLabel="Sim, regerar"
          description="Os documentos abaixo já foram gerados. O arquivo anterior vira versão anterior e o novo passa a ser o atual."
          onCancel={() => setConfirmRegerar([])}
          onConfirm={() => {
            void handleGerar(true);
          }}
        >
          <ul className="space-y-1 rounded-md border border-gray-200 bg-surface-subtle px-4 py-3 text-sm text-ink">
            {confirmRegerar.map((nome) => (
              <li key={nome}>{nome}</li>
            ))}
          </ul>
        </ConfirmDialog>
      )}

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
