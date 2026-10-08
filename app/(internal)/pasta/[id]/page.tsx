"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DocumentPreviewModal, type DocumentPreviewState } from "@/components/DocumentPreviewModal";
import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { PastaHeader } from "@/components/pasta/PastaHeader";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card } from "@/components/ui/Surface";
import {
  DOCUMENTO_STATUS,
  describeErrorOrigin,
  Feedback,
  StatusBadge,
  ToneMark,
  type Tone,
} from "@/components/ui/Status";

// Mesmo prazo de app/api/cron/retencao-pastas: concluída, a pasta some em 30 dias.
const DIAS_RETENCAO = 30;

interface Pasta {
  id: string;
  status: string;
  criadaEm: string;
  concluidaEm: string | null;
  clienteNomeFantasia: string | null;
  clienteRazaoSocial: string | null;
  clienteCnpj: string | null;
  clienteEstado: string | null;
  clienteCidade: string | null;
  clienteRtNome: string | null;
  clienteLogoPath: string | null;
  legislacaoIds: string | null;
  documentos: Array<{
    id: string;
    nomeArquivo: string;
    status: string;
    tokensUsados: number | null;
    mensagemErro: string | null;
    templateId: string | null;
    template?: { tipo: string } | null;
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

interface Conferencia {
  tone: Tone;
  titulo: string;
  detalhe?: string;
  acao?: { href: string; rotulo: string };
}

function contarIds(value: string | null): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function listarNomes(nomes: string[]): string {
  if (nomes.length <= 3) return nomes.join(", ") + ".";
  return `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}.`;
}

function dataCurta(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
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
  const [confirmarConclusao, setConfirmarConclusao] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");

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

  const docsGerados = pasta.documentos.filter((d) => d.status === "gerado");
  const docsComErro = pasta.documentos.filter((d) => d.status === "erro");
  const gerados = docsGerados.length;
  const comErro = docsComErro.length;
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
  const concluida = pasta.status === "concluida";
  const legislacoesAssociadas = contarIds(pasta.legislacaoIds);
  const semLogo = docsGerados.filter((d) => !d.logoSubstituida);
  const citamRt = docsGerados.filter((d) => d.avisoRtNoCorpo);
  const exclusaoEm = concluida && pasta.concluidaEm
    ? new Date(new Date(pasta.concluidaEm).getTime() + DIAS_RETENCAO * 24 * 60 * 60 * 1000)
    : null;
  const gerar = `/pasta/${id}/processar`;

  // Conferência de entrega: cada linha diz o que está certo ou o que fazer, com
  // o atalho para resolver. Erro bloqueia a entrega; atenção pede conferência.
  const conferencias: Conferencia[] = [];
  if (total === 0) {
    conferencias.push({ tone: "erro", titulo: "Nenhum documento na pasta", acao: { href: gerar, rotulo: "Adicionar documentos" } });
  }
  conferencias.push(
    camposPendentes.length > 0
      ? {
          tone: "erro",
          titulo: "Dados da cliente incompletos",
          detalhe: `Falta: ${camposPendentes.join(", ")}.`,
          acao: { href: `/pasta/${id}/editar`, rotulo: "Completar dados" },
        }
      : { tone: "sucesso", titulo: "Dados essenciais da cliente preenchidos" }
  );
  if (semTemplate > 0) {
    conferencias.push({
      tone: "erro",
      titulo: `${semTemplate} documento(s) sem template`,
      acao: { href: gerar, rotulo: "Definir templates" },
    });
  }
  if (comErro > 0) {
    conferencias.push({
      tone: "erro",
      titulo: `${comErro} documento(s) com erro na geração`,
      detalhe: listarNomes(docsComErro.map((d) => d.nomeArquivo)),
      acao: { href: gerar, rotulo: "Regerar" },
    });
  }
  if (pendentes > 0) {
    conferencias.push({
      tone: "atencao",
      titulo: `${pendentes} documento(s) ainda não gerados`,
      acao: { href: gerar, rotulo: "Ir para Gerar" },
    });
  } else if (total > 0 && comErro === 0) {
    conferencias.push({ tone: "sucesso", titulo: `Todos os ${total} documentos gerados` });
  }
  if (!pasta.clienteLogoPath) {
    conferencias.push({
      tone: "atencao",
      titulo: "Logo da cliente não enviada",
      acao: { href: `/pasta/${id}/editar`, rotulo: "Enviar logo" },
    });
  } else if (semLogo.length > 0) {
    conferencias.push({
      tone: "atencao",
      titulo: `Logo não substituída em ${semLogo.length} documento(s)`,
      detalhe: listarNomes(semLogo.map((d) => d.nomeArquivo)),
      acao: { href: gerar, rotulo: "Regerar" },
    });
  } else if (gerados > 0) {
    conferencias.push({ tone: "sucesso", titulo: `Logo aplicada nos ${gerados} documento(s) gerados` });
  }
  if (citamRt.length > 0) {
    conferencias.push({
      tone: "atencao",
      titulo: `${citamRt.length} documento(s) citam o responsável técnico no corpo`,
      detalhe: `Confira o texto antes de entregar: ${listarNomes(citamRt.map((d) => d.nomeArquivo))}`,
      acao: { href: `/pasta/${id}/varredura`, rotulo: "Abrir varredura" },
    });
  }
  conferencias.push(
    legislacoesAssociadas > 0
      ? { tone: "sucesso", titulo: `${legislacoesAssociadas} legislação(ões) associada(s)` }
      : {
          tone: "atencao",
          titulo: "Nenhuma legislação associada",
          detalhe: "As referências dos documentos saem sem as normas da UF.",
          acao: { href: gerar, rotulo: "Revisar legislações" },
        }
  );

  const bloqueios = conferencias.filter((c) => c.tone === "erro").length;
  const pendencias = conferencias.filter((c) => c.tone !== "sucesso").length;
  const prontaParaEntrega = total > 0 && bloqueios === 0 && pendentes === 0;

  const porTipo = Object.entries(
    pasta.documentos.reduce<Record<string, number>>((acc, d) => {
      const tipo = d.template?.tipo || "Sem template";
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));

  const documentosOrdenados = [...pasta.documentos].sort((a, b) => {
    const aGerado = a.status === "gerado" ? 1 : 0;
    const bGerado = b.status === "gerado" ? 1 : 0;
    if (aGerado !== bGerado) return aGerado - bGerado;
    return a.nomeArquivo.localeCompare(b.nomeArquivo, "pt-BR", { sensitivity: "base" });
  });

  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");

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
      setPasta((current) =>
        current ? { ...current, status: updated.status, concluidaEm: updated.concluidaEm ?? null } : current
      );
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

  async function excluirPasta() {
    setExcluindo(true);
    setErroExclusao("");
    try {
      const response = await fetch(`/api/pastas/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `O banco recusou a exclusão (HTTP ${response.status}).`);
      router.push("/");
    } catch (error) {
      setErroExclusao(error instanceof Error ? error.message : "Não foi possível excluir a pasta.");
      setExcluindo(false);
    }
  }

  return (
    <div className="mx-auto max-w-[80rem]">
      <ScrollToTopButton />

      <PastaHeader
        id={id}
        nome={pasta.clienteNomeFantasia}
        status={pasta.status}
        meta={[
          [pasta.clienteCidade, pasta.clienteEstado].filter(Boolean).join(" / "),
          pasta.clienteRtNome ? `RT: ${pasta.clienteRtNome}` : "",
          `${total} documento${total !== 1 ? "s" : ""}`,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            {gerados > 0 ? (
              <>
                <Link href={gerar} className={buttonClass("secondary")}>
                  Gerar documentos
                </Link>
                <a href={`/api/pastas/${id}/download`} className={buttonClass("primary")}>
                  Baixar ZIP final ({gerados})
                </a>
              </>
            ) : (
              <Link href={gerar} className={buttonClass("primary")}>
                Gerar documentos
              </Link>
            )}
            <ActionMenu
              label="Mais ações da pasta"
              variant="secondary"
              items={[
                {
                  label: duplicating ? "Duplicando..." : "Duplicar pasta",
                  disabled: duplicating,
                  onSelect: () => { void duplicarPasta(); },
                },
                concluida
                  ? { label: "Reabrir pasta", disabled: updatingStatus, onSelect: () => { void atualizarStatus("rascunho"); } }
                  : { label: "Marcar como concluída…", disabled: updatingStatus, onSelect: () => setConfirmarConclusao(true) },
                { label: "Excluir pasta…", destrutiva: true, onSelect: () => setConfirmarExclusao(true) },
              ]}
            />
          </>
        }
      />

      <div aria-live="polite">
        {actionError && (
          <Feedback tone="erro" title={describeErrorOrigin(actionError).rotulo} className="mb-5">
            {actionError}
          </Feedback>
        )}
      </div>

      {exclusaoEm && (
        <Feedback tone="atencao" title="Pasta concluída" className="mb-5">
          Ela e os arquivos gerados serão excluídos em <strong>{dataCurta(exclusaoEm)}</strong>. Baixe o ZIP
          final antes disso. Para manter, use <strong>Reabrir pasta</strong> no menu ⋯.
        </Feedback>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="conferencia-titulo" className="rounded-lg border border-gray-200 bg-surface-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 id="conferencia-titulo" className="font-display text-base text-ink">
                  Conferência de entrega
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {prontaParaEntrega
                    ? pendencias > 0
                      ? "Pode entregar. Confira os avisos abaixo antes."
                      : "Tudo certo. A pasta está pronta para entrega."
                    : `${pendencias} pendência(s) antes de baixar a pasta final.`}
                </p>
              </div>
              {prontaParaEntrega ? (
                <StatusBadge tone="sucesso">Pronta para entrega</StatusBadge>
              ) : (
                <StatusBadge tone={bloqueios > 0 ? "erro" : "atencao"}>
                  {pendencias} pendência{pendencias !== 1 ? "s" : ""}
                </StatusBadge>
              )}
            </div>
            <ul className="divide-y divide-gray-200 border-t border-gray-200">
              {conferencias.map((item) => (
                <li key={item.titulo} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">
                  <ToneMark tone={item.tone} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{item.titulo}</p>
                    {item.detalhe && <p className="text-sm text-ink-muted">{item.detalhe}</p>}
                  </div>
                  {item.acao ? (
                    <Link href={item.acao.href} className={buttonClass("secondary")}>
                      {item.acao.rotulo}
                    </Link>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="documentos-titulo" className="rounded-lg border border-gray-200 bg-surface-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 id="documentos-titulo" className="font-display text-base text-ink">
                Documentos
              </h2>
              <span className="text-sm text-ink-muted">{gerados} de {total} gerados</span>
            </div>
            {pasta.documentos.length === 0 ? (
              <p className="border-t border-gray-200 px-5 py-6 text-sm text-ink-muted">
                Nenhum documento listado ainda. Use <strong>Gerar documentos</strong> para escolher os
                templates desta pasta.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 border-t border-gray-200">
                {documentosOrdenados.map((doc) => {
                  const docStatus = DOCUMENTO_STATUS[doc.status] || DOCUMENTO_STATUS.pendente;
                  const versoesAnteriores = doc.versoes.filter(
                    (versao) => versao.outputPath !== doc.outputPath
                  );
                  const detalhes = [
                    doc.template?.tipo,
                    doc.tokensUsados ? `${doc.tokensUsados.toLocaleString("pt-BR")} tokens` : "",
                  ].filter(Boolean).join(" · ");
                  return (
                    <li key={doc.id} className="px-5 py-2.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-ink">{doc.nomeArquivo}</p>
                          {detalhes && <p className="text-sm text-ink-muted">{detalhes}</p>}
                        </div>
                        <div>
                          <StatusBadge tone={docStatus.tone}>{docStatus.label}</StatusBadge>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {doc.outputPath && (
                            <>
                              <Button
                                variant="quiet"
                                aria-label={`Visualizar ${doc.nomeArquivo}`}
                                onClick={() => {
                                  void visualizarDocumento(doc);
                                }}
                              >
                                Visualizar
                              </Button>
                              <a
                                href={`/api/pastas/${id}/documentos/${doc.id}/download`}
                                aria-label={`Baixar ${doc.nomeArquivo}`}
                                className={buttonClass("quiet")}
                              >
                                Baixar
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      {doc.mensagemErro && (
                        <p className="mt-0.5 text-sm text-status-danger">
                          <span className="font-semibold">{describeErrorOrigin(doc.mensagemErro).rotulo}:</span>{" "}
                          {doc.mensagemErro}
                        </p>
                      )}

                      {versoesAnteriores.length > 0 && (
                        <details className="mt-1 text-sm text-ink-muted">
                          <summary className="cursor-pointer font-semibold text-brand-accent">
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
          </section>
        </div>

        <aside aria-label="Resumo da pasta" className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Documentos</h2>
            <div
              className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-subtle"
              role="img"
              aria-label={`${gerados} gerados, ${comErro} com erro e ${pendentes} pendentes de ${total}`}
            >
              <span className="bg-status-success" style={{ width: pct(gerados) }} />
              <span className="bg-status-danger" style={{ width: pct(comErro) }} />
            </div>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              <dt className="text-ink-muted">Gerados</dt>
              <dd className="font-bold text-ink">{gerados}</dd>
              <dt className="text-ink-muted">Com erro</dt>
              <dd className={`font-bold ${comErro > 0 ? "text-status-danger" : "text-ink"}`}>{comErro}</dd>
              <dt className="text-ink-muted">Pendentes</dt>
              <dd className="font-bold text-ink">{pendentes}</dd>
            </dl>
          </Card>

          {porTipo.length > 0 && (
            <Card className="p-4">
              <h2 className="font-display text-base text-ink">Por tipo</h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {porTipo.map(([tipo, quantidade]) => (
                  <li
                    key={tipo}
                    className="rounded-full border border-gray-200 bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-ink-muted"
                  >
                    {tipo} {quantidade}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Dados da cliente</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                { rotulo: "Razão social", valor: pasta.clienteRazaoSocial },
                { rotulo: "CNPJ", valor: pasta.clienteCnpj },
                { rotulo: "Responsável técnico", valor: pasta.clienteRtNome },
                { rotulo: "Localização", valor: [pasta.clienteCidade, pasta.clienteEstado].filter(Boolean).join(" / ") },
                { rotulo: "Criada em", valor: dataCurta(pasta.criadaEm) },
              ].map((item) => (
                <div key={item.rotulo}>
                  <dt className="text-ink-muted">{item.rotulo}</dt>
                  <dd className="font-semibold text-ink">{item.valor || "—"}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/pasta/${id}/editar`} className={buttonClass("quiet", "mt-2 -ml-2")}>
              Editar dados ›
            </Link>
          </Card>
        </aside>
      </div>

      {confirmarConclusao && (
        <ConfirmDialog
          title="Marcar a pasta como concluída?"
          confirmLabel="Sim, concluir"
          busy={updatingStatus}
          description={
            <>
              Concluída, a pasta e os arquivos gerados são excluídos automaticamente{" "}
              <strong>{DIAS_RETENCAO} dias depois</strong>. Baixe o ZIP final antes. Até lá, dá para reabrir.
            </>
          }
          onCancel={() => setConfirmarConclusao(false)}
          onConfirm={() => {
            setConfirmarConclusao(false);
            void atualizarStatus("concluida");
          }}
        />
      )}

      {confirmarExclusao && (
        <ConfirmDialog
          title="Excluir esta pasta?"
          confirmLabel={excluindo ? "Excluindo..." : "Excluir pasta"}
          destrutiva
          busy={excluindo}
          error={erroExclusao}
          description={
            <>
              Remove <strong>{pasta.clienteNomeFantasia || "a pasta"}</strong>, os {total} documento(s) e os
              arquivos gerados. Não dá para desfazer.
            </>
          }
          onCancel={() => {
            setConfirmarExclusao(false);
            setErroExclusao("");
          }}
          onConfirm={() => {
            void excluirPasta();
          }}
        />
      )}

      <DocumentPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
