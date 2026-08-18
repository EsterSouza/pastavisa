"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader, PageHeader } from "@/components/ui/Surface";
import {
  DOCUMENTO_STATUS,
  describeErrorOrigin,
  Feedback,
  PASTA_STATUS,
  StatusBadge,
} from "@/components/ui/Status";

interface Pasta {
  id: string;
  status: string;
  criadaEm: string;
  clienteNomeFantasia: string | null;
  clienteRazaoSocial: string | null;
  clienteCnpj: string | null;
  clienteEstado: string | null;
  clienteCidade: string | null;
  clienteRtNome: string | null;
  documentos: Array<{
    id: string;
    nomeArquivo: string;
    status: string;
    tokensUsados: number | null;
    mensagemErro: string | null;
    templateId: string | null;
    outputPath: string | null;
    avisoRtNoCorpo: boolean;
    logoSubstituida: boolean;
    versoes: Array<{
      id: string;
      outputPath: string;
      criadaEm: string;
    }>;
  }>;
}

export default function PastaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [loadError, setLoadError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [preview, setPreview] = useState<DocumentPreviewState | null>(null);

  useEffect(() => {
    fetch(`/api/pastas/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`O banco não devolveu esta pasta (HTTP ${r.status}).`);
        return r.json();
      })
      .then(setPasta)
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar a pasta do banco."
        );
      });
  }, [id]);

  if (loadError) {
    return (
      <Feedback tone="erro" title={describeErrorOrigin(loadError).rotulo} live>
        {loadError} Atualize a página para tentar novamente.
      </Feedback>
    );
  }

  if (!pasta) return <p className="text-sm text-ink-muted">Carregando pasta...</p>;

  const gerados = pasta.documentos.filter((d) => d.status === "gerado").length;
  const comErro = pasta.documentos.filter((d) => d.status === "erro").length;
  const pendentes = pasta.documentos.filter(
    (d) => d.status === "pendente" || d.status === "processando"
  ).length;
  const semTemplate = pasta.documentos.filter((d) => !d.templateId).length;
  const camposPendentes = [
    !pasta.clienteNomeFantasia && "nome fantasia",
    !pasta.clienteCnpj && "CNPJ",
    !pasta.clienteEstado && "estado",
    !pasta.clienteCidade && "cidade",
    !pasta.clienteRtNome && "responsável técnico",
  ].filter(Boolean) as string[];
  const total = pasta.documentos.length;
  const prontaParaEntrega =
    total > 0 &&
    gerados === total &&
    comErro === 0 &&
    semTemplate === 0 &&
    camposPendentes.length === 0;
  const status = PASTA_STATUS[pasta.status] || PASTA_STATUS.rascunho;
  const concluida = pasta.status === "concluida";

  // Cada linha diz o que fazer, não só o que está errado.
  const pendencias: Array<{ texto: string; grave: boolean; acao?: { href: string; rotulo: string } }> = [
    total === 0
      ? { texto: "Nenhum documento na pasta.", grave: true, acao: { href: `/pasta/${id}/processar`, rotulo: "Adicionar documentos" } }
      : null,
    camposPendentes.length > 0
      ? {
          texto: `Dados do cliente faltando: ${camposPendentes.join(", ")}.`,
          grave: true,
          acao: { href: `/pasta/${id}/editar`, rotulo: "Completar cadastro" },
        }
      : null,
    semTemplate > 0
      ? {
          texto: `${semTemplate} documento(s) sem template definido.`,
          grave: true,
          acao: { href: `/pasta/${id}/processar`, rotulo: "Definir templates" },
        }
      : null,
    comErro > 0
      ? {
          texto: `${comErro} documento(s) terminaram com erro.`,
          grave: true,
          acao: { href: `/pasta/${id}/processar`, rotulo: "Regerar" },
        }
      : null,
    pendentes > 0
      ? {
          texto: `${pendentes} documento(s) ainda não foram gerados.`,
          grave: false,
          acao: { href: `/pasta/${id}/processar`, rotulo: "Gerar agora" },
        }
      : null,
  ].filter(Boolean) as Array<{ texto: string; grave: boolean; acao?: { href: string; rotulo: string } }>;

  const documentosOrdenados = [...pasta.documentos].sort((a, b) => {
    const aGerado = a.status === "gerado" ? 1 : 0;
    const bGerado = b.status === "gerado" ? 1 : 0;
    if (aGerado !== bGerado) return aGerado - bGerado;
    return a.nomeArquivo.localeCompare(b.nomeArquivo, "pt-BR", { sensitivity: "base" });
  });

  async function visualizarDocumento(doc: { id: string; nomeArquivo: string }, versaoId?: string) {
    const title = versaoId ? `${doc.nomeArquivo} — versão anterior` : doc.nomeArquivo;
    setPreview({ title, html: "", loading: true });
    try {
      const query = versaoId ? `?versaoId=${encodeURIComponent(versaoId)}` : "";
      const response = await fetch(`/api/pastas/${id}/documentos/${doc.id}/preview${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar preview");
      setPreview({ title, html: data.html || "", loading: false });
    } catch (error) {
      setPreview({
        title,
        html: "",
        loading: false,
        error: error instanceof Error ? error.message : "Falha ao carregar preview",
      });
    }
  }

  async function atualizarStatus(novoStatus: "rascunho" | "concluida") {
    if (!pasta) return;
    setUpdatingStatus(true);
    setActionError("");
    const previous = pasta;
    setPasta({ ...pasta, status: novoStatus });
    try {
      const res = await fetch(`/api/pastas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) throw new Error(`O banco recusou a mudança de status (HTTP ${res.status}).`);
      const updated = await res.json();
      setPasta((current) => (current ? { ...current, status: updated.status } : current));
    } catch (error) {
      setPasta(previous);
      setActionError(
        error instanceof Error ? error.message : "Não foi possível gravar o status no banco."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function duplicarPasta() {
    setDuplicating(true);
    setActionError("");
    try {
      const response = await fetch(`/api/pastas/${id}/duplicar`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao duplicar pasta");
      router.push(`/pasta/${data.pastaId}/editar`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Falha ao duplicar pasta");
      setDuplicating(false);
    }
  }

  return (
    <div>
      <ScrollToTopButton />

      <PageHeader
        title={pasta.clienteNomeFantasia || "Pasta sem nome"}
        badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        description={[pasta.clienteRazaoSocial, pasta.clienteCnpj].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/pasta/${id}/processar`} className={buttonClass("primary")}>
              Gerar documentos
            </Link>
            {gerados > 0 && (
              <a href={`/api/pastas/${id}/download`} className={buttonClass("secondary")}>
                Baixar ZIP ({gerados})
              </a>
            )}
            <Link href={`/pasta/${id}/editar`} className={buttonClass("secondary")}>
              Editar dados
            </Link>
            <Link href={`/pasta/${id}/corrigir-lote`} className={buttonClass("secondary")}>
              Corrigir em lote
            </Link>
            <Button
              variant="secondary"
              disabled={duplicating}
              onClick={() => {
                void duplicarPasta();
              }}
            >
              {duplicating ? "Duplicando..." : "Duplicar pasta"}
            </Button>
            <Button
              variant="secondary"
              disabled={updatingStatus}
              onClick={() => {
                void atualizarStatus(concluida ? "rascunho" : "concluida");
              }}
            >
              {concluida ? "Reabrir pasta" : "Marcar concluída"}
            </Button>
          </>
        }
      />

      <div aria-live="polite">
        {actionError && (
          <Feedback tone="erro" title={describeErrorOrigin(actionError).rotulo} className="mb-6">
            {actionError}
          </Feedback>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: "Localização", valor: [pasta.clienteCidade, pasta.clienteEstado].filter(Boolean).join(" / ") || "—" },
          { rotulo: "Responsável técnico", valor: pasta.clienteRtNome || "—" },
          { rotulo: "Documentos gerados", valor: `${gerados} de ${total}` },
          { rotulo: "Criada em", valor: new Date(pasta.criadaEm).toLocaleDateString("pt-BR") },
        ].map((item) => (
          <Card key={item.rotulo} className="p-4">
            <p className="text-sm text-ink-muted">{item.rotulo}</p>
            <p className="mt-1 font-semibold text-ink">{item.valor}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Conferência final"
          description={
            prontaParaEntrega
              ? "Pasta pronta para entrega."
              : "Resolva as pendências abaixo antes de entregar."
          }
          actions={
            gerados > 0 ? (
              <a href={`/api/pastas/${id}/download`} className={buttonClass("primary")}>
                Baixar ZIP final
              </a>
            ) : undefined
          }
        />
        <div className="px-4 py-4 sm:px-5">
          {prontaParaEntrega ? (
            <Feedback tone="sucesso" title="Sem pendências">
              Dados essenciais preenchidos, templates definidos e todos os {total} documentos gerados
              sem erro.
            </Feedback>
          ) : (
            <ul className="space-y-2">
              {pendencias.map((pendencia) => (
                <li key={pendencia.texto} className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone={pendencia.grave ? "erro" : "atencao"}>
                    {pendencia.grave ? "Bloqueia" : "Pendente"}
                  </StatusBadge>
                  <span className="min-w-[12rem] flex-1 text-sm text-ink">{pendencia.texto}</span>
                  {pendencia.acao && (
                    <Link href={pendencia.acao.href} className={buttonClass("secondary")}>
                      {pendencia.acao.rotulo}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Documentos" meta={`${gerados}/${total} gerados`} />
        {pasta.documentos.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">
            Nenhum documento listado ainda. Use <strong>Gerar documentos</strong> para escolher os
            templates desta pasta.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {documentosOrdenados.map((doc) => {
              const docStatus = DOCUMENTO_STATUS[doc.status] || DOCUMENTO_STATUS.pendente;
              const versoesAnteriores = doc.versoes.filter(
                (versao) => versao.outputPath !== doc.outputPath
              );
              return (
                <li key={doc.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-[14rem] flex-1 break-words text-sm text-ink">
                      {doc.nomeArquivo}
                    </span>
                    {doc.tokensUsados ? (
                      <span className="text-sm tabular-nums text-ink-subtle">
                        {doc.tokensUsados.toLocaleString("pt-BR")} tokens
                      </span>
                    ) : null}
                    <StatusBadge tone={docStatus.tone}>{docStatus.label}</StatusBadge>
                    {doc.outputPath && (
                      <>
                        <Button
                          variant="quiet"
                          onClick={() => {
                            void visualizarDocumento(doc);
                          }}
                        >
                          Visualizar
                        </Button>
                        <a
                          href={`/api/pastas/${id}/documentos/${doc.id}/download`}
                          className={buttonClass("quiet")}
                        >
                          Baixar atual
                        </a>
                      </>
                    )}
                  </div>

                  {doc.mensagemErro && (
                    <Feedback
                      tone="erro"
                      title={describeErrorOrigin(doc.mensagemErro).rotulo}
                      className="mt-2"
                    >
                      {doc.mensagemErro}
                    </Feedback>
                  )}

                  {versoesAnteriores.length > 0 && (
                    <details className="mt-2 text-sm text-ink-muted">
                      <summary className="cursor-pointer text-brand-accent">
                        Versões anteriores ({versoesAnteriores.length})
                      </summary>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {versoesAnteriores.map((versao) => (
                          <li
                            key={versao.id}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-surface-subtle px-2.5 py-1"
                          >
                            <span>{new Date(versao.criadaEm).toLocaleString("pt-BR")}</span>
                            <Button
                              variant="quiet"
                              onClick={() => {
                                void visualizarDocumento(doc, versao.id);
                              }}
                            >
                              Visualizar
                            </Button>
                            <a
                              href={`/api/pastas/${id}/documentos/${doc.id}/download?versaoId=${versao.id}`}
                              className={buttonClass("quiet")}
                            >
                              Baixar
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
