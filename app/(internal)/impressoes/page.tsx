"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, PageHeader } from "@/components/ui/Surface";
import {
  CUSTOS,
  custoDaPasta,
  FRANQUIA_PAGINAS,
  ITENS_DE_CUSTO,
  pastaImpressa,
  planilhaCsv,
  reais,
  tipoDoDocumento,
  type DocumentoContado,
} from "@/lib/contagem-paginas";

type Contagem = {
  id: string;
  pastaId: string | null;
  cliente: string;
  versao: string | null;
  paginas: number;
  documentos: string;
  contadaEm: string;
};

/** Mês no fuso do navegador: uma contagem às 22h do dia 31 não pode cair no mês seguinte. */
const mesDe = (data: string) => {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const nomeDoMes = (mes: string) => {
  const nome = new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
};
const media = (soma: number, n: number) => (n ? Math.round(soma / n) : 0);

export default function Impressoes() {
  const [contagens, setContagens] = useState<Contagem[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/impressoes")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setContagens(d.contagens))
      .catch(() => setErro("Não deu para carregar as contagens."));
  }, []);

  if (erro) return <p className="text-sm text-status-danger">{erro}</p>;
  if (!contagens) return <p className="text-sm text-ink-muted">Carregando…</p>;

  const impressas = contagens.filter((c) => pastaImpressa(c.versao));
  const doMesDe = (mes: string) => contagens.filter((c) => mesDe(c.contadaEm) === mes);
  const custos = new Map(contagens.map((c) => [c.id, custoDaPasta(c, doMesDe(mesDe(c.contadaEm)))]));
  const meses = Array.from(new Set(contagens.map((c) => mesDe(c.contadaEm)))).map((mes) => {
    const todas = doMesDe(mes);
    const doMes = todas.filter((c) => pastaImpressa(c.versao));
    const soma = (campo: "preco" | "custo" | "sobra") => todas.reduce((s, c) => s + (custos.get(c.id)?.[campo] || 0), 0);
    return {
      mes,
      pastas: doMes.length,
      digitais: todas.length - doMes.length,
      paginas: doMes.reduce((s, c) => s + c.paginas, 0),
      faturamento: soma("preco"),
      custo: soma("custo"),
      sobra: soma("sobra"),
    };
  });

  const porTipo = new Map<string, { paginas: number; documentos: number }>();
  for (const c of impressas) {
    for (const d of JSON.parse(c.documentos) as DocumentoContado[]) {
      const tipo = tipoDoDocumento(d.nome);
      const atual = porTipo.get(tipo) || { paginas: 0, documentos: 0 };
      porTipo.set(tipo, { paginas: atual.paginas + d.paginas, documentos: atual.documentos + 1 });
    }
  }
  const tipos = Array.from(porTipo.entries()).sort((a, b) => b[1].paginas - a[1].paginas);
  const ultimas = impressas.slice(0, 3);
  const mediaUltimas = media(ultimas.reduce((s, c) => s + c.paginas, 0), ultimas.length);

  /** Uma linha por pasta contada, com cada item do custo; o resumo por mês sai de uma tabela dinâmica. */
  const exportar = () => {
    const linhas: Array<Array<string | number>> = [
      ["Data", "Mês", "Cliente", "Versão", "PDFs", "Páginas", "Preço", ...ITENS_DE_CUSTO, "Custo", "Sobra"],
    ];
    for (const c of contagens) {
      const custo = custos.get(c.id)!;
      const itens = new Map(custo.itens);
      linhas.push([
        new Date(c.contadaEm).toLocaleDateString("pt-BR"),
        nomeDoMes(mesDe(c.contadaEm)),
        c.cliente,
        c.versao || "",
        (JSON.parse(c.documentos) as DocumentoContado[]).length,
        c.paginas,
        custo.preco,
        ...ITENS_DE_CUSTO.map((rotulo) => itens.get(rotulo) || 0),
        custo.custo,
        custo.sobra,
      ]);
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([planilhaCsv(linhas)], { type: "text/csv;charset=utf-8" }));
    link.download = `impressoes-pastavisa-${new Date().toLocaleDateString("sv-SE")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <PageHeader
        title="Impressões"
        actions={
          contagens.length > 0 && (
            <Button variant="secondary" onClick={exportar}>
              Exportar planilha
            </Button>
          )
        }
      />
      {contagens.length === 0 ? (
        <EmptyState
          title="Nenhuma pasta contada ainda"
          description='Na tela da pasta, use "Contar páginas" e escolha a pasta "PDF" da cliente.'
        />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-ink-muted">Média das 3 últimas impressas</p>
              <p className="font-display text-2xl text-ink">{mediaUltimas} páginas</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-ink-muted">Média de todas as impressas</p>
              <p className="font-display text-2xl text-ink">{media(impressas.reduce((s, c) => s + c.paginas, 0), impressas.length)} páginas</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-ink-muted">Pastas impressas que cabem na franquia</p>
              <p className="font-display text-2xl text-ink">
                {Math.floor(FRANQUIA_PAGINAS / (mediaUltimas || 1))} por mês
              </p>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Por mês</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-ink-muted">
                <tr>
                  <th className="py-1.5 font-normal">Mês</th>
                  <th className="py-1.5 font-normal">Impressas</th>
                  <th className="py-1.5 font-normal">Só digitais</th>
                  <th className="py-1.5 font-normal">Páginas impressas</th>
                  <th className="py-1.5 font-normal">Franquia de {FRANQUIA_PAGINAS.toLocaleString("pt-BR")}</th>
                  <th className="py-1.5 font-normal">Faturamento</th>
                  <th className="py-1.5 font-normal">Custo</th>
                  <th className="py-1.5 font-normal">Sobra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 border-t border-gray-200">
                {meses.map((m) => {
                  const uso = Math.round((m.paginas / FRANQUIA_PAGINAS) * 100);
                  return (
                    <tr key={m.mes}>
                      <td className="py-1.5 text-ink">{nomeDoMes(m.mes)}</td>
                      <td className="py-1.5 text-ink">{m.pastas}</td>
                      <td className="py-1.5 text-ink">{m.digitais}</td>
                      <td className="py-1.5 font-semibold text-ink">{m.paginas.toLocaleString("pt-BR")}</td>
                      <td className={`py-1.5 font-semibold ${uso > 100 ? "text-status-danger" : "text-ink"}`}>
                        {uso}%{uso > 100 ? `, ${(m.paginas - FRANQUIA_PAGINAS).toLocaleString("pt-BR")} além` : ""}
                      </td>
                      <td className="py-1.5 text-ink">{reais(m.faturamento)}</td>
                      <td className="py-1.5 text-ink">{reais(m.custo)}</td>
                      <td className="py-1.5 font-semibold text-status-success">{reais(m.sobra)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-ink-muted">
              Custo com imposto de {CUSTOS.imposto * 100}%, Pix, IA estimada em {reais(CUSTOS.iaPorPasta)} por pasta, e nas impressas papel, pasta catálogo e
              envio. O Kevin ({reais(CUSTOS.kevinMes)}) é dividido pelas pastas contadas no mês e a impressora ({reais(CUSTOS.impressoraMes)}) pelas
              impressas, então conte também as pastas só digitais.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Páginas por tipo de documento (pastas impressas)</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-ink-muted">
                <tr>
                  <th className="py-1.5 font-normal">Tipo</th>
                  <th className="py-1.5 font-normal">Páginas por documento</th>
                  <th className="py-1.5 font-normal">Páginas por pasta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 border-t border-gray-200">
                {tipos.map(([tipo, t]) => (
                  <tr key={tipo}>
                    <td className="py-1.5 text-ink">{tipo}</td>
                    <td className="py-1.5 text-ink">{(t.paginas / t.documentos).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
                    <td className="py-1.5 font-semibold text-ink">{media(t.paginas, impressas.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-base text-ink">Pastas contadas</h2>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-ink-muted">
                <tr>
                  <th className="py-1.5 font-normal">Data</th>
                  <th className="py-1.5 font-normal">Cliente</th>
                  <th className="py-1.5 font-normal">Versão</th>
                  <th className="py-1.5 font-normal">PDFs</th>
                  <th className="py-1.5 font-normal">Páginas</th>
                  <th className="py-1.5 font-normal">Preço</th>
                  <th className="py-1.5 font-normal">Custo</th>
                  <th className="py-1.5 font-normal">Sobra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 border-t border-gray-200">
                {contagens.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 text-ink">{new Date(c.contadaEm).toLocaleDateString("pt-BR")}</td>
                    <td className="py-1.5 text-ink">
                      {c.pastaId ? (
                        <Link href={`/pasta/${c.pastaId}`} className="text-brand-accent underline-offset-4 hover:underline">
                          {c.cliente}
                        </Link>
                      ) : (
                        c.cliente
                      )}
                    </td>
                    <td className="py-1.5 text-ink">{c.versao || "—"}</td>
                    <td className="py-1.5 text-ink">{(JSON.parse(c.documentos) as DocumentoContado[]).length}</td>
                    <td className="py-1.5 font-semibold text-ink">{c.paginas}</td>
                    <td className="py-1.5 text-ink">{reais(custos.get(c.id)?.preco || 0)}</td>
                    <td className="py-1.5 text-ink">{reais(custos.get(c.id)?.custo || 0)}</td>
                    <td className="py-1.5 font-semibold text-status-success">{reais(custos.get(c.id)?.sobra || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
