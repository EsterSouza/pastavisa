"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/Surface";
import {
  atualizarLegislacao,
  criarLegislacao,
  excluirLegislacao,
  importarArquivoLegislacoes,
  listarLegislacoes,
} from "@/components/legislacoes/api";
import { BLANK_FORM, type Legislacao, type ReferenciaImportada } from "@/components/legislacoes/constants";
import { AddForm, type AddFormState } from "@/components/legislacoes/AddForm";
import { ImportPanel } from "@/components/legislacoes/ImportPanel";
import { LegislacaoList } from "@/components/legislacoes/LegislacaoList";
import { EditModal } from "@/components/legislacoes/EditModal";

export default function Legislacoes() {
  const [items, setItems] = useState<Legislacao[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEsfera, setFiltroEsfera] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [form, setForm] = useState<AddFormState>({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Legislacao | null>(null);
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

  const [excluirAlvo, setExcluirAlvo] = useState<Legislacao | null>(null);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    setItems(await listarLegislacoes());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await criarLegislacao({
        ...form,
        municipio: form.municipio.trim() || null,
        destaqueAbnt: form.destaqueAbnt.trim() || null,
      });
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
      const data = await importarArquivoLegislacoes(importFile, importEstado, importMunicipio);
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
        await criarLegislacao({ ...referencia });
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
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSaving(true);
    setEditError("");
    try {
      await atualizarLegislacao(editando.id, {
        estadoUf: editando.estadoUf,
        municipio: editando.municipio || null,
        tipo: editando.tipo,
        titulo: editando.titulo,
        referenciaAbnt: editando.referenciaAbnt,
        destaqueAbnt: editando.destaqueAbnt?.trim() || null,
      });
      setEditando(null);
      await load();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Erro ao atualizar referência.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirAlvo) return;
    setDeleteError("");
    setDeletandoId(excluirAlvo.id);
    try {
      await excluirLegislacao(excluirAlvo.id);
      setExcluirAlvo(null);
      await load();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Erro ao excluir legislação.");
    } finally {
      setDeletandoId(null);
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await atualizarLegislacao(id, { ativo: !ativo });
    await load();
  }

  return (
    <div>
      <PageHeader title="Biblioteca de Legislações" />

      <AddForm
        form={form}
        onFormChange={setForm}
        onSubmit={(e) => {
          void handleSave(e);
        }}
        saving={saving}
        error={formError}
      />

      <ImportPanel
        importFile={importFile}
        onFileChange={setImportFile}
        importEstado={importEstado}
        onImportEstadoChange={setImportEstado}
        importMunicipio={importMunicipio}
        onImportMunicipioChange={setImportMunicipio}
        onAnalisar={() => {
          void analisarArquivoLegislacoes();
        }}
        importando={importando}
        importError={importError}
        importMsg={importMsg}
        importPreview={importPreview}
        referenciasImportadas={referenciasImportadas}
        selecionadasImportacao={selecionadasImportacao}
        onToggleImportada={toggleImportada}
        onAdicionarSelecionadas={() => {
          void adicionarReferenciasImportadas();
        }}
      />

      <LegislacaoList
        items={items}
        busca={busca}
        onBuscaChange={setBusca}
        filtroEstado={filtroEstado}
        onFiltroEstadoChange={setFiltroEstado}
        filtroEsfera={filtroEsfera}
        onFiltroEsferaChange={setFiltroEsfera}
        filtroSegmento={filtroSegmento}
        onFiltroSegmentoChange={setFiltroSegmento}
        onEditar={(leg) => {
          setEditError("");
          setEditando({ ...leg });
        }}
        onToggleAtivo={(id, ativo) => {
          void toggleAtivo(id, ativo);
        }}
        onExcluir={(leg) => {
          setDeleteError("");
          setExcluirAlvo(leg);
        }}
        deletandoId={deletandoId}
      />

      {editando && (
        <EditModal
          editando={editando}
          onChange={setEditando}
          onSubmit={(e) => {
            void handleEdit(e);
          }}
          onClose={() => setEditando(null)}
          saving={saving}
          error={editError}
        />
      )}

      {excluirAlvo && (
        <ConfirmDialog
          title="Excluir legislação?"
          description={
            <>
              Excluir <strong>{excluirAlvo.titulo}</strong>? Esta ação não pode ser desfeita.
            </>
          }
          confirmLabel={deletandoId === excluirAlvo.id ? "Excluindo..." : "Excluir"}
          destrutiva
          busy={deletandoId === excluirAlvo.id}
          error={deleteError}
          onConfirm={() => {
            void confirmarExclusao();
          }}
          onCancel={() => setExcluirAlvo(null)}
        />
      )}
    </div>
  );
}
