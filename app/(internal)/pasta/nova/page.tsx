"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, FormSection, PageHeader } from "@/components/ui/Surface";
import { describeErrorOrigin, Feedback } from "@/components/ui/Status";

interface DocExtraido {
  nome: string;
  tipo: string;
}

interface LegislacaoAssociada {
  id: string;
  titulo: string;
  tipo: string;
  estadoUf: string;
  municipio?: string | null;
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

interface DadosExtraidos {
  clienteNomeFantasia?: string;
  clienteRazaoSocial?: string;
  clienteCnpj?: string;
  clienteCidade?: string;
  clienteEstado?: string;
  clienteRtNome?: string;
  clienteRtProfissao?: string;
  documentosAGerar?: DocExtraido[];
  [key: string]: unknown;
}

interface ExtrairResult {
  sessionId: string;
  pdfPath: string;
  docxPath: string;
  data: DadosExtraidos;
  tokensUsados: number;
  legislacoesAssociadas: LegislacaoAssociada[];
  referenciasNaoCadastradas?: ReferenciaNaoCadastrada[];
  elaboracaoTextPreview: string | null;
}

interface DirectUploadFile {
  path: string;
  token: string;
  ref: string;
}

type UploadPlan =
  | { mode: "multipart" }
  | {
      mode: "direct";
      supabaseUrl: string;
      supabaseAnonKey: string;
      bucket: string;
      pdf: DirectUploadFile;
      docx: DirectUploadFile;
    };

type Fase = "upload" | "revisao";

const FILE_INPUT_CLASS =
  "block w-full rounded-md border border-gray-300 bg-surface-card p-1 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-accent";

async function readApiResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let data: { error?: string } | T;

  try {
    data = JSON.parse(text) as { error?: string } | T;
  } catch {
    if (res.status === 413 || /request entity too large|function_payload_too_large/i.test(text)) {
      throw new Error("Os arquivos excedem o limite de envio. Tente novamente após atualizar a página.");
    }
    throw new Error(fallback);
  }

  if (!res.ok) {
    throw new Error(("error" in (data as { error?: string }) && (data as { error?: string }).error) || fallback);
  }

  return data as T;
}

export default function NovaPasta() {
  const router = useRouter();

  // Fase 1 — upload
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [error, setError] = useState("");
  const [progresso, setProgresso] = useState("");

  // Fase 2 — revisão
  const [fase, setFase] = useState<Fase>("upload");
  const [resultado, setResultado] = useState<ExtrairResult | null>(null);
  const [docsRevisao, setDocsRevisao] = useState<DocExtraido[]>([]);
  const [docsSelecionados, setDocsSelecionados] = useState<Set<number>>(new Set());
  const [referenciasNaoCadastradas, setReferenciasNaoCadastradas] = useState<ReferenciaNaoCadastrada[]>([]);
  const [referenciasSelecionadas, setReferenciasSelecionadas] = useState<Set<number>>(new Set());
  const [salvandoReferencias, setSalvandoReferencias] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // ── Fase 1: analisar ─────────────────────────────────────────────
  async function handleAnalisar(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile || !docxFile) {
      setError("Faça upload dos dois arquivos obrigatórios.");
      return;
    }

    setAnalisando(true);
    setError("");
    setProgresso("Enviando arquivos para análise…");

    try {
      const planRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfName: pdfFile.name, docxName: docxFile.name }),
      });
      const plan = await readApiResponse<UploadPlan>(planRes, "Erro ao preparar o upload dos arquivos");

      let res: Response;
      if (plan.mode === "direct") {
        setProgresso("Enviando arquivos para armazenamento seguro…");
        const supabase = createClient(plan.supabaseUrl, plan.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const uploads: Array<[DirectUploadFile, File]> = [
          [plan.pdf, pdfFile],
          [plan.docx, docxFile],
        ];

        for (const [target, file] of uploads) {
          const { error: uploadError } = await supabase.storage
            .from(plan.bucket)
            .uploadToSignedUrl(target.path, target.token, file, {
              contentType: file.type || undefined,
            });
          if (uploadError) throw new Error(`Erro no upload de ${file.name}: ${uploadError.message}`);
        }

        setProgresso("Lendo PDF e identificando dados do cliente com IA…");
        res = await fetch("/api/extrair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfPath: plan.pdf.ref, docxPath: plan.docx.ref }),
        });
      } else {
        const formData = new FormData();
        formData.append("formsPdf", pdfFile);
        formData.append("documentosElaboracao", docxFile);
        setProgresso("Lendo PDF e identificando dados do cliente com IA…");
        res = await fetch("/api/extrair", { method: "POST", body: formData });
      }

      const json = await readApiResponse<ExtrairResult>(res, "Erro na extração dos dados");

      // Pre-select all suggested documents
      const docs: DocExtraido[] = json.data?.documentosAGerar || [];
      setDocsRevisao(docs);
      setDocsSelecionados(new Set(docs.map((_, i) => i)));
      const referencias = json.referenciasNaoCadastradas || [];
      setReferenciasNaoCadastradas(referencias);
      setReferenciasSelecionadas(new Set(referencias.map((_, i) => i)));
      setResultado(json as ExtrairResult);
      setFase("revisao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao analisar os arquivos");
    } finally {
      setAnalisando(false);
      setProgresso("");
    }
  }

  // ── Fase 2: confirmar ────────────────────────────────────────────
  async function handleConfirmar() {
    if (!resultado) return;
    setConfirmando(true);
    setError("");

    const selecionados = docsRevisao.filter((_, i) => docsSelecionados.has(i));

    try {
      let res: Response;
      try {
        res = await fetch("/api/extrair/confirmar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfPath: resultado.pdfPath,
            docxPath: resultado.docxPath,
            data: resultado.data,
            documentosSelecionados: selecionados,
            legislacaoIds: resultado.legislacoesAssociadas.map((legislacao) => legislacao.id),
          }),
        });
      } catch {
        throw new Error("Não foi possível conectar ao servidor para gravar a pasta no banco. Tente novamente em instantes.");
      }
      const json = await readApiResponse<{ pastaId: string }>(res, "Erro ao criar a pasta no banco");
      if (!json.pastaId) throw new Error("O banco criou a pasta sem devolver o ID.");

      router.push(`/pasta/${json.pastaId}/editar`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido ao criar a pasta");
      setConfirmando(false);
    }
  }

  function toggleDoc(i: number) {
    setDocsSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function removeDoc(i: number) {
    setDocsRevisao((prev) => prev.filter((_, index) => index !== i));
    setDocsSelecionados((prev) => {
      const next = new Set<number>();
      prev.forEach((index) => {
        if (index < i) next.add(index);
        if (index > i) next.add(index - 1);
      });
      return next;
    });
  }

  function toggleReferencia(i: number) {
    setReferenciasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function adicionarReferenciasSelecionadas() {
    if (!resultado || referenciasSelecionadas.size === 0) return;
    setSalvandoReferencias(true);
    setError("");
    try {
      const selecionadas = referenciasNaoCadastradas.filter((_, index) => referenciasSelecionadas.has(index));
      const adicionadas: LegislacaoAssociada[] = [];
      for (const referencia of selecionadas) {
        const response = await fetch("/api/legislacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(referencia),
        });
        const data = await readApiResponse<LegislacaoAssociada>(response, "Erro ao gravar a referência no banco");
        adicionadas.push(data);
      }
      setResultado({
        ...resultado,
        legislacoesAssociadas: [
          ...resultado.legislacoesAssociadas,
          ...adicionadas,
        ],
      });
      setReferenciasNaoCadastradas((current) => current.filter((_, index) => !referenciasSelecionadas.has(index)));
      setReferenciasSelecionadas(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gravar as referências no banco");
    } finally {
      setSalvandoReferencias(false);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // FASE 1 — Upload
  // ────────────────────────────────────────────────────────────────
  if (fase === "upload") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Nova Pasta Sanitária"
          description="Envie os dois arquivos do cliente. A leitura identifica os dados do estabelecimento e a lista de documentos a gerar."
        />

        <form onSubmit={handleAnalisar} className="space-y-6">
          <FormSection
            title="Arquivos do cliente"
            description="Os dois são obrigatórios e vêm da etapa comercial."
          >
            <div>
              <label htmlFor="forms-pdf" className="mb-1 block text-sm font-semibold text-ink">
                PDF do forms.app (obrigatório)
              </label>
              <input
                id="forms-pdf"
                type="file"
                accept=".pdf"
                aria-describedby="forms-pdf-hint"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className={FILE_INPUT_CLASS}
              />
              <p id="forms-pdf-hint" className="mt-1 text-sm text-ink-muted">
                Formulário preenchido pelo cliente no forms.app.
              </p>
            </div>

            <div>
              <label htmlFor="doc-elaboracao" className="mb-1 block text-sm font-semibold text-ink">
                Documentos em Elaboração, .docx (obrigatório)
              </label>
              <input
                id="doc-elaboracao"
                type="file"
                accept=".docx"
                aria-describedby="doc-elaboracao-hint"
                onChange={(e) => setDocxFile(e.target.files?.[0] || null)}
                className={FILE_INPUT_CLASS}
              />
              <p id="doc-elaboracao-hint" className="mt-1 text-sm text-ink-muted">
                Documento com a lista de documentos a gerar para este cliente.
              </p>
            </div>
          </FormSection>

          <div aria-live="polite" className="space-y-4">
            {error && (
              <Feedback tone="erro" title={describeErrorOrigin(error).rotulo}>
                {error}
              </Feedback>
            )}
            {progresso && <Feedback tone="info" title="Em andamento">{progresso}</Feedback>}
          </div>

          <Button type="submit" disabled={analisando || !pdfFile || !docxFile} className="w-full">
            {analisando ? "Analisando…" : "Analisar necessidades"}
          </Button>
        </form>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // FASE 2 — Revisão
  // ────────────────────────────────────────────────────────────────
  const dados = resultado!.data;
  const docs = docsRevisao;
  const nomeCliente = dados?.clienteNomeFantasia || dados?.clienteRazaoSocial || "Cliente";
  const camposExtraidos = [
    dados?.clienteRazaoSocial && { rotulo: "Razão social", valor: dados.clienteRazaoSocial },
    dados?.clienteCnpj && { rotulo: "CNPJ", valor: dados.clienteCnpj },
    dados?.clienteCidade && {
      rotulo: "Cidade/UF",
      valor: `${dados.clienteCidade}${dados.clienteEstado ? ` — ${dados.clienteEstado}` : ""}`,
    },
    dados?.clienteRtNome && {
      rotulo: "Responsável técnico",
      valor: `${dados.clienteRtNome}${dados.clienteRtProfissao ? ` (${dados.clienteRtProfissao})` : ""}`,
    },
  ].filter(Boolean) as Array<{ rotulo: string; valor: string }>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Revisar antes de criar"
        description={`Leitura concluída com ${resultado!.tokensUsados} tokens. Confirme os documentos que entram na pasta.`}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setFase("upload");
              setResultado(null);
              setError("");
            }}
          >
            Voltar ao upload
          </Button>
        }
      />

      <div className="space-y-6">
        <FormSection title={`Dados extraídos — ${nomeCliente}`} description="Todos os campos podem ser editados na próxima tela.">
          {camposExtraidos.length === 0 ? (
            <Feedback tone="atencao" title="Nenhum dado do cliente foi reconhecido">
              Você ainda pode criar a pasta e preencher o cadastro manualmente na próxima tela.
            </Feedback>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {camposExtraidos.map((campo) => (
                <div key={campo.rotulo}>
                  <dt className="text-sm text-ink-muted">{campo.rotulo}</dt>
                  <dd className="font-semibold text-ink">{campo.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </FormSection>

        <Card>
          <CardHeader
            title="Referências reconhecidas no documento de elaboração"
            description="Somente referências já cadastradas entram na geração. Você ainda pode ajustar na tela de geração."
          />
          {resultado!.legislacoesAssociadas.length === 0 ? (
            <div className="px-4 py-4 sm:px-5">
              <Feedback tone="atencao" title="Nenhuma referência cadastrada foi reconhecida">
                Confira as legislações na tela de geração antes de emitir os arquivos.
              </Feedback>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {resultado!.legislacoesAssociadas.map((legislacao) => (
                <li key={legislacao.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm text-ink">{legislacao.titulo}</p>
                  <p className="text-sm text-ink-muted">
                    {legislacao.tipo} · {legislacao.estadoUf}
                    {legislacao.municipio ? ` · ${legislacao.municipio}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {referenciasNaoCadastradas.length > 0 && (
          <Card>
            <CardHeader
              title="Referências fora da base"
              description="Encontradas no Documento em Elaboração e sem correspondência cadastrada. Revise e adicione as corretas antes de criar a pasta."
              actions={
                <Button
                  disabled={salvandoReferencias || referenciasSelecionadas.size === 0}
                  onClick={() => {
                    void adicionarReferenciasSelecionadas();
                  }}
                >
                  {salvandoReferencias
                    ? "Adicionando..."
                    : `Adicionar ${referenciasSelecionadas.size} à base`}
                </Button>
              }
            />
            <ul className="divide-y divide-gray-200">
              {referenciasNaoCadastradas.map((referencia, index) => (
                <li key={`${referencia.referenciaAbnt}-${index}`} className="px-4 py-3 sm:px-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={referenciasSelecionadas.has(index)}
                      onChange={() => toggleReferencia(index)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{referencia.titulo}</span>
                      <span className="mt-0.5 block text-sm text-ink-muted">
                        {referencia.tipo} · {referencia.estadoUf === "BR" ? "Federal" : referencia.estadoUf}
                        {referencia.municipio ? ` · ${referencia.municipio}` : ""}
                      </span>
                      <span className="mt-1 block text-sm text-ink-muted">{referencia.referenciaAbnt}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Documentos sugeridos"
            description="Desmarque os que não quer gerar agora."
            meta={`${docsSelecionados.size} de ${docs.length} selecionados`}
            actions={
              docs.length > 0 ? (
                <>
                  <Button variant="quiet" onClick={() => setDocsSelecionados(new Set(docs.map((_, i) => i)))}>
                    Selecionar todos
                  </Button>
                  <Button variant="quiet" onClick={() => setDocsSelecionados(new Set())}>
                    Nenhum
                  </Button>
                </>
              ) : undefined
            }
          />

          {docs.length === 0 ? (
            <div className="space-y-4 px-4 py-5 sm:px-5">
              <Feedback tone="atencao" title="Nenhum documento foi identificado no arquivo de elaboração">
                Veja o diagnóstico abaixo e tente novamente, ou crie a pasta e adicione os documentos
                manualmente na tela de geração.
              </Feedback>

              {resultado!.elaboracaoTextPreview === null || resultado!.elaboracaoTextPreview === "" ? (
                <Feedback tone="erro" title="O arquivo .docx veio vazio">
                  <p>Nenhum texto foi extraído do arquivo enviado. Causas possíveis:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    <li>O arquivo está corrompido ou protegido por senha.</li>
                    <li>É um .docx cujo conteúdo está em imagem (escaneado).</li>
                    <li>O formato real é diferente de .docx (por exemplo, .doc antigo renomeado).</li>
                  </ul>
                </Feedback>
              ) : (
                <div className="rounded-md border border-gray-200 bg-surface-subtle px-4 py-3">
                  <p className="text-sm font-semibold text-ink">
                    Texto extraído do .docx (primeiros 600 caracteres)
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-muted">
                    {resultado!.elaboracaoTextPreview}
                  </pre>
                  <p className="mt-2 text-sm text-ink-muted">
                    Se o texto acima contém os documentos mas eles não foram reconhecidos, tente
                    novamente — ou crie a pasta e adicione manualmente.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {docs.map((doc, i) => (
                <li key={`${doc.nome}-${i}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <input
                    type="checkbox"
                    id={`doc-${i}`}
                    checked={docsSelecionados.has(i)}
                    onChange={() => toggleDoc(i)}
                    className="h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <label htmlFor={`doc-${i}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="text-sm text-ink">{doc.nome}</span>
                    {doc.tipo && (
                      <span className="ml-2 rounded-md bg-surface-subtle px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
                        {doc.tipo}
                      </span>
                    )}
                  </label>
                  <Button variant="quiet" aria-label={`Remover ${doc.nome}`} onClick={() => removeDoc(i)}>
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div aria-live="polite">
          {error && (
            <Feedback tone="erro" title={describeErrorOrigin(error).rotulo}>
              {error}
            </Feedback>
          )}
        </div>

        <div>
          <Button onClick={handleConfirmar} disabled={confirmando} className="w-full">
            {confirmando
              ? "Criando pasta…"
              : docsSelecionados.size === 0
              ? "Criar pasta sem documentos"
              : `Criar pasta com ${docsSelecionados.size} documento${docsSelecionados.size > 1 ? "s" : ""}`}
          </Button>
          <p className="mt-2 text-center text-sm text-ink-muted">
            Você vai revisar e completar os dados na próxima tela antes de gerar os arquivos.
          </p>
        </div>
      </div>
    </div>
  );
}
