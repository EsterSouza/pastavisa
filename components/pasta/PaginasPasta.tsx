"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { custoDaPasta, reais, type CustoPasta, type DocumentoContado } from "@/lib/contagem-paginas";

type Contagem = { id: string; versao: string | null; paginas: number; documentos: string; contadaEm: string };

const mesDe = (data: string) => {
  const d = new Date(data);
  return d.getFullYear() * 12 + d.getMonth();
};

/**
 * Páginas dos PDFs da pasta. Ela escolhe a pasta "PDF" da cliente; o navegador
 * conta as páginas com o pdf-lib, sem enviar os arquivos, e só o resultado vai
 * para o app.
 */
export function PaginasPasta({ pastaId }: { pastaId: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [contando, setContando] = useState("");
  const [erro, setErro] = useState("");
  const [abrir, setAbrir] = useState(false);
  const [custo, setCusto] = useState<CustoPasta | null>(null);

  useEffect(() => {
    fetch(`/api/pastas/${pastaId}/paginas`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setContagem(d.contagem))
      .catch(() => setErro("Não deu para ler a contagem guardada."));
  }, [pastaId]);

  // O Kevin e a impressora são divididos pelas pastas contadas no mesmo mês.
  useEffect(() => {
    if (!contagem) return;
    fetch("/api/impressoes")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { contagens: Contagem[] }) => {
        const doMes = d.contagens.filter((c) => mesDe(c.contadaEm) === mesDe(contagem.contadaEm));
        setCusto(custoDaPasta(contagem, doMes));
      })
      .catch(() => setCusto(null));
  }, [contagem]);

  async function contar(arquivos: FileList | null) {
    const pdfs = Array.from(arquivos || []).filter((a) => /\.pdf$/i.test(a.name));
    if (entrada.current) entrada.current.value = "";
    if (pdfs.length === 0) {
      setErro("Não há PDF nessa pasta. Escolha a pasta \"PDF\" da cliente.");
      return;
    }
    setErro("");
    const { PDFDocument } = await import("pdf-lib");
    const documentos: DocumentoContado[] = [];
    const falhas: string[] = [];
    for (let i = 0; i < pdfs.length; i++) {
      const arquivo = pdfs[i];
      setContando(`Contando ${i + 1} de ${pdfs.length}…`);
      try {
        const pdf = await PDFDocument.load(await arquivo.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
        documentos.push({ nome: arquivo.name.replace(/\.pdf$/i, ""), paginas: pdf.getPageCount() });
      } catch {
        falhas.push(arquivo.name);
      }
    }
    if (falhas.length > 0) {
      setContando("");
      setErro(`Não deu para ler ${falhas.length} PDF(s), e nada foi guardado: ${falhas.join(", ")}`);
      return;
    }
    setContando("Guardando…");
    try {
      const r = await fetch(`/api/pastas/${pastaId}/paginas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentos }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setContagem(d.contagem);
    } catch (e) {
      setErro(`A contagem não foi guardada: ${e instanceof Error ? e.message : "erro desconhecido"}.`);
    } finally {
      setContando("");
    }
  }

  const documentos: DocumentoContado[] = contagem ? JSON.parse(contagem.documentos) : [];

  return (
    <Card className="p-4">
      <h2 className="font-display text-base text-ink">Páginas e custo da pasta</h2>
      {contagem ? (
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-display text-2xl text-ink">{contagem.paginas}</span> páginas em {documentos.length} PDFs,
          contadas em {new Date(contagem.contadaEm).toLocaleDateString("pt-BR")}.
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Ainda não contadas. Escolha a pasta &quot;PDF&quot; da cliente quando ela estiver pronta.</p>
      )}

      <input
        ref={entrada}
        type="file"
        multiple
        className="hidden"
        {...{ webkitdirectory: "" }}
        onChange={(e) => void contar(e.target.files)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={Boolean(contando)} onClick={() => entrada.current?.click()}>
          {contagem ? "Contar de novo" : "Contar páginas"}
        </Button>
        {documentos.length > 0 && (
          <Button variant="quiet" onClick={() => setAbrir(!abrir)}>
            {abrir ? "Esconder documentos" : "Ver por documento"}
          </Button>
        )}
      </div>
      {contando && <p className="mt-2 text-sm text-ink-muted" role="status">{contando}</p>}
      {erro && <p className="mt-2 text-sm text-status-danger">{erro}</p>}

      {abrir && (
        <ul className="mt-3 divide-y divide-gray-200 border-t border-gray-200 text-sm">
          {[...documentos].sort((a, b) => b.paginas - a.paginas).map((d) => (
            <li key={d.nome} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0 text-ink">{d.nome}</span>
              <span className="shrink-0 font-semibold text-ink">{d.paginas}</span>
            </li>
          ))}
        </ul>
      )}
      {custo && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 border-t border-gray-200 pt-3 text-sm">
          <dt className="text-ink-muted">Preço</dt>
          <dd className="font-semibold text-ink">{reais(custo.preco)}</dd>
          {custo.itens.map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="text-ink-muted">{rotulo}</dt>
              <dd className="text-ink">{reais(valor)}</dd>
            </div>
          ))}
          <dt className="border-t border-gray-200 pt-1 text-ink">Custo estimado</dt>
          <dd className="border-t border-gray-200 pt-1 font-semibold text-ink">{reais(custo.custo)}</dd>
          <dt className="text-ink">Sobra</dt>
          <dd className="font-display text-lg text-status-success">
            {reais(custo.sobra)} ({Math.round((custo.sobra / custo.preco) * 100)}%)
          </dd>
        </dl>
      )}
      <Link href="/impressoes" className="mt-3 inline-block text-sm font-semibold text-brand-accent underline-offset-4 hover:underline">
        Ver impressões do mês ›
      </Link>
    </Card>
  );
}
