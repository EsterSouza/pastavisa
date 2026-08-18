"use client";

import { useEffect, useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Feedback } from "@/components/ui/Status";
import { PageHeader } from "@/components/ui/Surface";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import {
  atualizarTemplate,
  buscarPreview,
  buscarVariaveis,
  buscarVersoes,
  duplicarTemplate,
  enviarTemplate,
  excluirTemplate,
  importarTemplateEmLote,
  listarTemplates,
  recalcularTipoIa,
  restaurarVersao as restaurarVersaoApi,
} from "@/components/templates/api";
import {
  detectProcessingTypeClient,
  type BulkImportResult,
  type Template,
  type TemplateValidationReport,
  type TemplateVersion,
} from "@/components/templates/constants";
import { BulkImportPanel } from "@/components/templates/BulkImportPanel";
import { UploadForm, type UploadFormState } from "@/components/templates/UploadForm";
import { VariableLibrary } from "@/components/templates/VariableLibrary";
import { TemplateList } from "@/components/templates/TemplateList";
import { EditTemplateModal } from "@/components/templates/EditTemplateModal";
import { VariablesReportModal } from "@/components/templates/VariablesReportModal";
import { VersionsModal } from "@/components/templates/VersionsModal";

const BLANK_UPLOAD_FORM: UploadFormState = { nome: "", tipo: "MBP", padraoHeader: "A", processingType: "LIGHT_HAIKU" };

type DeleteAlvo = { kind: "um"; template: Template } | { kind: "lote"; quantidade: number };

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<UploadFormState>({ ...BLANK_UPLOAD_FORM });
  const [file, setFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importResults, setImportResults] = useState<BulkImportResult[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [editando, setEditando] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

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

  const [duplicando, setDuplicando] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPT, setFiltroPT] = useState("");

  const [deleteAlvo, setDeleteAlvo] = useState<DeleteAlvo | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [restaurarAlvo, setRestaurarAlvo] = useState<{ templateId: string; versaoId: string } | null>(null);
  const [restaurarError, setRestaurarError] = useState("");

  async function load() {
    try {
      setTemplates(await listarTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar templates.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRecalcularTipo() {
    setRecalculando(true);
    setError("");
    setImportMsg("");
    try {
      const data = await recalcularTipoIa();
      setImportMsg(
        data.corrigidos.length > 0
          ? `${data.corrigidos.length} de ${data.verificados} template(s) corrigido(s) para "Sem IA" (não tinham bloco de IA): ${data.corrigidos.join(", ")}.`
          : `Nenhuma correção necessária — todos os ${data.verificados} templates verificados já estão com o tipo de IA correto.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recalcular tipo de IA");
    } finally {
      setRecalculando(false);
    }
  }

  function handleFileChange(f: File | null) {
    setFile(f);
    if (f && !form.nome) {
      const nomeLimpo = f.name.replace(/^TEMPLATE_/i, "").replace(/_/g, " ").replace(/\.docx$/i, "");
      setForm((prev) => ({ ...prev, nome: nomeLimpo, processingType: detectProcessingTypeClient(f.name) }));
    } else if (f) {
      setForm((prev) => ({ ...prev, processingType: detectProcessingTypeClient(f.name) }));
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || !form.nome) {
      setError("Nome e arquivo são obrigatórios.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await enviarTemplate({ ...form, arquivo: file });
      setForm({ ...BLANK_UPLOAD_FORM });
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
    setImporting(true);
    setImportMsg("");
    setImportResults([]);
    try {
      const results: BulkImportResult[] = [];
      for (let index = 0; index < bulkFiles.length; index += 1) {
        const selectedFile = bulkFiles[index];
        setImportMsg(`Importando ${index + 1}/${bulkFiles.length}: ${selectedFile.name}`);
        try {
          const json = await importarTemplateEmLote(selectedFile);
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
    await atualizarTemplate(id, { ativo: !ativo });
    await load();
  }

  async function updateProcessingType(id: string, processingType: string) {
    await atualizarTemplate(id, { processingType });
    await load();
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSaving(true);
    await atualizarTemplate(editando.id, {
      nome: editando.nome,
      tipo: editando.tipo,
      padraoHeader: editando.padraoHeader,
      processingType: editando.processingType,
    });
    setEditando(null);
    setSaving(false);
    await load();
  }

  async function confirmarExclusao() {
    if (!deleteAlvo) return;
    setDeleteError("");
    try {
      if (deleteAlvo.kind === "um") {
        await excluirTemplate(deleteAlvo.template.id);
      } else {
        setBulkDeleting(true);
        await Promise.all(Array.from(selected).map((id) => excluirTemplate(id)));
        setSelected(new Set());
      }
      setDeleteAlvo(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleDuplicate(id: string) {
    setDuplicando(id);
    try {
      await duplicarTemplate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao duplicar template.");
    } finally {
      setDuplicando(null);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkToggleAtivo(ativar: boolean) {
    if (selected.size === 0) return;
    await Promise.all(Array.from(selected).map((id) => atualizarTemplate(id, { ativo: ativar })));
    setSelected(new Set());
    await load();
  }

  async function handleVerVariaveis(t: Template) {
    setLoadingVars(t.id);
    setError("");
    try {
      const json = await buscarVariaveis(t.id);
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
      const json = await buscarPreview(t.id);
      setPreview({ title: t.nome, html: json.html || "", loading: false });
    } catch (err) {
      setPreview({ title: t.nome, html: "", loading: false, error: err instanceof Error ? err.message : "Erro ao carregar preview." });
    } finally {
      setLoadingPreview(null);
    }
  }

  async function handleVerVersoes(t: Template) {
    setLoadingVersions(t.id);
    setError("");
    try {
      const json = await buscarVersoes(t.id);
      setVersionModal({ template: t, versoes: json });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar versões.");
    } finally {
      setLoadingVersions(null);
    }
  }

  async function confirmarRestauracao() {
    if (!restaurarAlvo) return;
    setRestaurarError("");
    setRestoringVersion(restaurarAlvo.versaoId);
    try {
      await restaurarVersaoApi(restaurarAlvo.templateId, restaurarAlvo.versaoId);
      await load();
      setVersionModal(null);
      setRestaurarAlvo(null);
      setImportMsg("Versão anterior restaurada com sucesso.");
    } catch (err) {
      setRestaurarError(err instanceof Error ? err.message : "Erro ao restaurar versão.");
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

  return (
    <div>
      <PageHeader
        title="Templates"
        actions={
          <button
            type="button"
            onClick={() => {
              void handleRecalcularTipo();
            }}
            disabled={recalculando}
            title="Verifica todos os templates e corrige para 'Sem IA' aqueles que não têm nenhum bloco de IA, mesmo que o nome sugira um documento complexo."
            className={buttonClass("secondary", "text-xs")}
          >
            {recalculando ? "Verificando..." : "Recalcular tipo de IA"}
          </button>
        }
      />

      {importMsg && (
        <Feedback tone="sucesso" live className="mb-4">
          {importMsg}
        </Feedback>
      )}

      <BulkImportPanel
        bulkFiles={bulkFiles}
        onFilesChange={setBulkFiles}
        onImport={() => {
          void handleBulkImport();
        }}
        importing={importing}
        importResults={importResults}
      />

      <UploadForm
        form={form}
        onFormChange={setForm}
        onFileChange={handleFileChange}
        onSubmit={(e) => {
          void handleUpload(e);
        }}
        uploading={uploading}
        error={error}
      />

      <VariableLibrary
        open={catalogOpen}
        onToggle={() => setCatalogOpen((open) => !open)}
        search={catalogSearch}
        onSearchChange={setCatalogSearch}
        category={catalogCategory}
        onCategoryChange={setCatalogCategory}
        copiedTag={copiedTag}
        onCopyTag={(tag) => {
          void copyTag(tag);
        }}
      />

      <TemplateList
        templates={templates}
        busca={busca}
        onBuscaChange={setBusca}
        filtroTipo={filtroTipo}
        onFiltroTipoChange={setFiltroTipo}
        filtroPT={filtroPT}
        onFiltroPTChange={setFiltroPT}
        selected={selected}
        onToggleOne={toggleOne}
        onSelectAll={(ids) => setSelected(new Set(ids))}
        onSelectNone={() => setSelected(new Set())}
        onBulkToggleAtivo={(ativar) => {
          void handleBulkToggleAtivo(ativar);
        }}
        onBulkDelete={() => {
          setDeleteError("");
          setDeleteAlvo({ kind: "lote", quantidade: selected.size });
        }}
        bulkDeleting={bulkDeleting}
        onUpdateProcessingType={(id, pt) => {
          void updateProcessingType(id, pt);
        }}
        onVisualizar={(t) => {
          void handleVisualizarTemplate(t);
        }}
        onValidar={(t) => {
          void handleVerVariaveis(t);
        }}
        onVerVersoes={(t) => {
          void handleVerVersoes(t);
        }}
        onEditar={(t) => setEditando({ ...t })}
        onDuplicar={(id) => {
          void handleDuplicate(id);
        }}
        onToggleAtivo={(id, ativo) => {
          void toggleAtivo(id, ativo);
        }}
        onExcluir={(t) => {
          setDeleteError("");
          setDeleteAlvo({ kind: "um", template: t });
        }}
        loadingPreview={loadingPreview}
        loadingVars={loadingVars}
        loadingVersions={loadingVersions}
        duplicando={duplicando}
      />

      {editando && (
        <EditTemplateModal
          editando={editando}
          onChange={setEditando}
          onSubmit={(e) => {
            void handleEditSave(e);
          }}
          onClose={() => setEditando(null)}
          saving={saving}
          copiedTag={copiedTag}
          onCopyTag={(tag) => {
            void copyTag(tag);
          }}
        />
      )}

      {variavelModal && (
        <VariablesReportModal
          nome={variavelModal.nome}
          report={variavelModal.report}
          onClose={() => setVariavelModal(null)}
          copiedTag={copiedTag}
          onCopyTag={(tag) => {
            void copyTag(tag);
          }}
        />
      )}

      {versionModal && (
        <VersionsModal
          template={versionModal.template}
          versoes={versionModal.versoes}
          onRestaurar={(templateId, versaoId) => {
            setRestaurarError("");
            setRestaurarAlvo({ templateId, versaoId });
          }}
          onClose={() => setVersionModal(null)}
          restoringVersion={restoringVersion}
        />
      )}

      {deleteAlvo && (
        <ConfirmDialog
          title={deleteAlvo.kind === "um" ? "Excluir template?" : `Excluir ${deleteAlvo.quantidade} templates?`}
          description={
            deleteAlvo.kind === "um" ? (
              <>
                Excluir <strong>{deleteAlvo.template.nome}</strong>? Esta ação não pode ser desfeita.
              </>
            ) : (
              `Excluir ${deleteAlvo.quantidade} template${deleteAlvo.quantidade > 1 ? "s" : ""} selecionado${deleteAlvo.quantidade > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`
            )
          }
          confirmLabel={bulkDeleting ? "Excluindo..." : "Excluir"}
          destrutiva
          busy={bulkDeleting}
          error={deleteError}
          onConfirm={() => {
            void confirmarExclusao();
          }}
          onCancel={() => setDeleteAlvo(null)}
        />
      )}

      {restaurarAlvo && (
        <ConfirmDialog
          title="Restaurar esta versão?"
          description="A versão atual será guardada no histórico antes da restauração."
          confirmLabel={restoringVersion ? "Restaurando..." : "Restaurar versão"}
          busy={!!restoringVersion}
          error={restaurarError}
          onConfirm={() => {
            void confirmarRestauracao();
          }}
          onCancel={() => setRestaurarAlvo(null)}
        />
      )}

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
