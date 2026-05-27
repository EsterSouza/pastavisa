"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

async function readApiResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let data: { error?: string } | T;

  try {
    data = JSON.parse(text) as { error?: string } | T;
  } catch {
    if (res.status === 413 || /request entity too large|function_payload_too_large/i.test(text)) {
      throw new Error("Os arquivos excedem o limite de envio. Tente novamente apos atualizar a pagina.");
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
      const plan = await readApiResponse<UploadPlan>(planRes, "Erro ao preparar envio dos arquivos");

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

      const json = await readApiResponse<ExtrairResult>(res, "Erro na extração");

      // Pre-select all suggested documents
      const docs: DocExtraido[] = json.data?.documentosAGerar || [];
      setDocsRevisao(docs);
      setDocsSelecionados(new Set(docs.map((_, i) => i)));
      setResultado(json as ExtrairResult);
      setFase("revisao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
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
      const res = await fetch("/api/extrair/confirmar", {
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar pasta");

      router.push(`/pasta/${json.pastaId}/editar`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
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

  // ────────────────────────────────────────────────────────────────
  // FASE 1 — Upload
  // ────────────────────────────────────────────────────────────────
  if (fase === "upload") {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Nova Pasta Sanitária</h1>
        <p className="text-sm text-gray-500 mb-6">
          Faça o upload dos dois arquivos. A IA vai ler o formulário e identificar quais documentos precisam ser gerados.
        </p>

        <form onSubmit={handleAnalisar} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PDF do forms.app <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-lg p-1"
            />
            <p className="text-xs text-gray-400 mt-1">Formulário preenchido pelo cliente no forms.app</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Documentos em Elaboração (.docx) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setDocxFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-lg p-1"
            />
            <p className="text-xs text-gray-400 mt-1">Documento com a lista de documentos a gerar para este cliente</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {progresso && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {progresso}
            </div>
          )}

          <button
            type="submit"
            disabled={analisando || !pdfFile || !docxFile}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analisando ? "Analisando com IA…" : "Analisar Necessidades"}
          </button>
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revisar antes de criar</h1>
          <p className="text-sm text-gray-500 mt-1">
            A IA usou {resultado!.tokensUsados} tokens · Confirme os documentos a gerar
          </p>
        </div>
        <button
          onClick={() => { setFase("upload"); setResultado(null); setError(""); }}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5"
        >
          ← Novo upload
        </button>
      </div>

      {/* Client preview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-gray-800 mb-3">Dados extraídos — {nomeCliente}</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {dados?.clienteRazaoSocial && (
            <div><span className="text-gray-500">Razão social:</span>{" "}
              <span className="text-gray-800 font-medium">{dados.clienteRazaoSocial}</span>
            </div>
          )}
          {dados?.clienteCnpj && (
            <div><span className="text-gray-500">CNPJ:</span>{" "}
              <span className="text-gray-800 font-medium">{dados.clienteCnpj}</span>
            </div>
          )}
          {dados?.clienteCidade && (
            <div><span className="text-gray-500">Cidade/UF:</span>{" "}
              <span className="text-gray-800 font-medium">{dados.clienteCidade}{dados.clienteEstado ? ` — ${dados.clienteEstado}` : ""}</span>
            </div>
          )}
          {dados?.clienteRtNome && (
            <div><span className="text-gray-500">RT:</span>{" "}
              <span className="text-gray-800 font-medium">{dados.clienteRtNome}{dados.clienteRtProfissao ? ` (${dados.clienteRtProfissao})` : ""}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Todos os campos podem ser editados na próxima tela.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl mb-5">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Referências associadas do documento de elaboração</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Somente referências reconhecidas no arquivo enviado serão levadas para a geração. Você ainda poderá ajustar na próxima tela.
          </p>
        </div>
        {resultado!.legislacoesAssociadas.length === 0 ? (
          <p className="px-5 py-4 text-sm text-amber-700">
            Nenhuma referência cadastrada foi reconhecida no documento. Confira na tela de geração antes de emitir os arquivos.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {resultado!.legislacoesAssociadas.map((legislacao) => (
              <li key={legislacao.id} className="px-5 py-3">
                <p className="text-sm text-gray-800">{legislacao.titulo}</p>
                <p className="text-xs text-gray-500">
                  {legislacao.tipo} · {legislacao.estadoUf}
                  {legislacao.municipio ? ` · ${legislacao.municipio}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Document checklist */}
      <div className="bg-white border border-gray-200 rounded-xl mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">
              Documentos sugeridos{" "}
              <span className="text-gray-400 font-normal">({docsSelecionados.size} de {docs.length} selecionados)</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Desmarque os que não quer gerar agora</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setDocsSelecionados(new Set(docs.map((_, i) => i)))}
              className="text-blue-600 hover:underline">Todos</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => setDocsSelecionados(new Set())}
              className="text-gray-500 hover:underline">Nenhum</button>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="px-5 py-6 space-y-3">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              A IA não identificou documentos no arquivo de elaboração. Verifique o diagnóstico abaixo e tente novamente, ou crie a pasta e adicione os documentos manualmente.
            </p>

            {/* Diagnostic block */}
            {resultado!.elaboracaoTextPreview === null || resultado!.elaboracaoTextPreview === "" ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-red-700 mb-1">⚠ O arquivo .docx veio vazio</p>
                <p className="text-xs text-red-600">
                  O mammoth não conseguiu extrair nenhum texto do arquivo enviado. Possíveis causas:
                </p>
                <ul className="text-xs text-red-600 mt-1 list-disc list-inside space-y-0.5">
                  <li>O arquivo está corrompido ou protegido por senha</li>
                  <li>É um .docx mas o conteúdo está em imagem (escaneado)</li>
                  <li>O formato real é diferente de .docx (ex: .doc antigo renomeado)</li>
                </ul>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  Texto extraído do .docx (primeiros 600 caracteres):
                </p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {resultado!.elaboracaoTextPreview}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  Se o texto acima contém os documentos mas a IA não os reconheceu, tente novamente — ou crie a pasta e adicione manualmente.
                </p>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((doc, i) => (
              <li key={`${doc.nome}-${i}`} className="px-5 py-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`doc-${i}`}
                  checked={docsSelecionados.has(i)}
                  onChange={() => toggleDoc(i)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <label htmlFor={`doc-${i}`} className="flex-1 cursor-pointer">
                  <span className="text-sm text-gray-800">{doc.nome}</span>
                  {doc.tipo && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {doc.tipo}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => removeDoc(i)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleConfirmar}
        disabled={confirmando}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-base"
      >
        {confirmando
          ? "Criando pasta…"
          : docsSelecionados.size === 0
          ? "Criar pasta sem documentos →"
          : `Criar pasta com ${docsSelecionados.size} documento${docsSelecionados.size > 1 ? "s" : ""} →`}
      </button>
      <p className="text-xs text-center text-gray-400 mt-2">
        Você vai revisar e completar os dados na próxima tela antes de gerar os arquivos.
      </p>
    </div>
  );
}
