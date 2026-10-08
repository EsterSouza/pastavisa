"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { PastaHeader, usePastaCabecalho } from "@/components/pasta/PastaHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Surface";
import { Feedback, StatusBadge, type Tone } from "@/components/ui/Status";
import type { AlertaVarredura, TipoAlerta } from "@/lib/revisao/varredura";

interface DocumentoVarrido {
  id: string;
  nomeArquivo: string;
  alertas: AlertaVarredura[];
}

const TIPO: Record<TipoAlerta, { rotulo: string; tone: Tone }> = {
  estrutura: { rotulo: "Arquivo", tone: "erro" },
  variavel: { rotulo: "Variável", tone: "erro" },
  norma: { rotulo: "Norma", tone: "atencao" },
  travessao: { rotulo: "Travessão", tone: "atencao" },
  termo: { rotulo: "Termo", tone: "neutro" },
};

export default function VarreduraPasta() {
  const { id } = useParams<{ id: string }>();
  const [documentos, setDocumentos] = useState<DocumentoVarrido[] | null>(null);
  const [varrendo, setVarrendo] = useState(false);
  const [erro, setErro] = useState("");
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);
  const cabecalho = usePastaCabecalho(id);

  async function chamar<T>(url: string): Promise<T> {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Falha (HTTP ${res.status})`);
    return data as T;
  }

  async function varrer() {
    setVarrendo(true);
    setErro("");
    try {
      const data = await chamar<{ documentos: DocumentoVarrido[] }>(`/api/pastas/${id}/varredura`);
      setDocumentos(data.documentos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na varredura");
    } finally {
      setVarrendo(false);
    }
  }

  useEffect(() => {
    void varrer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function visualizar(docId: string, nomeArquivo: string) {
    setPreview({ title: nomeArquivo, html: "", loading: true });
    try {
      const data = await chamar<{ html: string }>(`/api/pastas/${id}/documentos/${docId}/preview`);
      setPreview({ title: nomeArquivo, html: data.html || "", loading: false });
    } catch (e) {
      setPreview({ title: nomeArquivo, html: "", loading: false, error: e instanceof Error ? e.message : "Falha ao carregar preview" });
    }
  }

  const comAlerta = documentos?.filter((d) => d.alertas.length > 0) ?? [];
  const limpos = documentos?.filter((d) => d.alertas.length === 0) ?? [];

  return (
    <div className="mx-auto max-w-[80rem]">
      <PastaHeader id={id} nome={cabecalho ? cabecalho.nome : undefined} status={cabecalho?.status} meta={cabecalho?.local || undefined} />

      {erro && (
        <Feedback tone="erro" title="Erro" className="mb-6">
          {erro}
        </Feedback>
      )}

      <Card className="mb-6">
        <CardHeader
          title="Varredura sem IA"
          description="Arquivo íntegro, variável que sobrou, travessão, norma fora do cadastro e termos que costumam vir do template genérico."
          meta={documentos ? `${comAlerta.length} de ${documentos.length} com alerta` : undefined}
          actions={
            <Button variant="secondary" disabled={varrendo} onClick={() => void varrer()}>
              {varrendo ? "Varrendo..." : "Varrer de novo"}
            </Button>
          }
        />
        {documentos && comAlerta.length === 0 && (
          <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">
            {documentos.length === 0 ? "Nenhum documento gerado nesta pasta." : "Nenhum alerta."}
          </p>
        )}
        {comAlerta.length > 0 && (
          <ul className="divide-y divide-gray-200">
            {comAlerta.map((doc) => (
              <li key={doc.id} className="px-4 py-2 sm:px-5">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                    <span className="flex-1 break-words text-sm font-semibold text-ink">{doc.nomeArquivo}</span>
                    <span className="flex gap-1">
                      {(Object.keys(TIPO) as TipoAlerta[])
                        .filter((tipo) => doc.alertas.some((a) => a.tipo === tipo))
                        .map((tipo) => (
                          <StatusBadge key={tipo} tone={TIPO[tipo].tone}>
                            {TIPO[tipo].rotulo} {doc.alertas.filter((a) => a.tipo === tipo).length}
                          </StatusBadge>
                        ))}
                    </span>
                    <Button
                      variant="quiet"
                      onClick={(e) => {
                        e.preventDefault();
                        void visualizar(doc.id, doc.nomeArquivo);
                      }}
                    >
                      Visualizar
                    </Button>
                  </summary>
                  <ul className="mt-2 space-y-1 pb-2">
                    {doc.alertas.map((alerta, i) => (
                      <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                        <StatusBadge tone={TIPO[alerta.tipo].tone}>{TIPO[alerta.tipo].rotulo}</StatusBadge>
                        <span className="text-ink">{alerta.mensagem}</span>
                        {alerta.trecho && <span className="w-full pl-2 text-ink-muted">…{alerta.trecho}…</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
        {limpos.length > 0 && (
          <details className="border-t border-gray-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink sm:px-5">
              Sem alertas ({limpos.length})
            </summary>
            <ul className="divide-y divide-gray-200 border-t border-gray-200">
              {limpos.map((doc) => (
                <li key={doc.id} className="px-4 py-2 text-sm text-ink sm:px-5">
                  {doc.nomeArquivo}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
