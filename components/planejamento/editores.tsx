"use client";

import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import type { CampoRotulado } from "@/lib/planejamento/tipos";

// Editores simples da tela de revisão do planejamento: campos "Rótulo: valor",
// listas de uma linha por item e tabelas.

export function CamposRotulados({
  campos,
  onChange,
  rotuloNovo = "Novo campo",
}: {
  campos: CampoRotulado[];
  onChange: (campos: CampoRotulado[]) => void;
  rotuloNovo?: string;
}) {
  const mudar = (i: number, parte: Partial<CampoRotulado>) =>
    onChange(campos.map((c, j) => (j === i ? { ...c, ...parte } : c)));
  return (
    <div className="space-y-2">
      {campos.map((campo, i) => (
        <div key={i} className="grid grid-cols-[14rem_minmax(0,1fr)_auto] items-start gap-2">
          <input
            aria-label="Rótulo"
            className={`${fieldClass} font-semibold`}
            value={campo.rotulo}
            onChange={(e) => mudar(i, { rotulo: e.target.value })}
          />
          <textarea
            aria-label={campo.rotulo || "Valor"}
            className={fieldClass}
            rows={Math.min(4, Math.max(1, Math.ceil(campo.valor.length / 90)))}
            value={campo.valor}
            placeholder="(fica só o rótulo no documento)"
            onChange={(e) => mudar(i, { valor: e.target.value })}
          />
          <Button variant="quiet" aria-label={`Tirar ${campo.rotulo}`} onClick={() => onChange(campos.filter((_, j) => j !== i))}>
            Tirar
          </Button>
        </div>
      ))}
      <Button variant="quiet" className="-ml-2" onClick={() => onChange([...campos, { rotulo: rotuloNovo, valor: "" }])}>
        + Acrescentar campo
      </Button>
    </div>
  );
}

/** Uma linha por item. */
export function ListaLinhas({
  rotulo,
  itens,
  onChange,
  linhas,
}: {
  rotulo: string;
  itens: string[];
  onChange: (itens: string[]) => void;
  linhas?: number;
}) {
  return (
    <label className="block">
      <span className="sr-only">{rotulo}</span>
      <textarea
        className={`${fieldClass} font-mono text-[13px] leading-6`}
        rows={linhas ?? Math.max(3, itens.length + 1)}
        value={itens.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        onBlur={() => onChange(itens.map((i) => i.trim()).filter(Boolean))}
      />
    </label>
  );
}

export interface Coluna<T> {
  chave: keyof T & string;
  titulo: string;
  largura: string;
}

export function TabelaEditavel<T extends object>({
  colunas,
  linhas,
  onChange,
  nova,
}: {
  colunas: Array<Coluna<T>>;
  linhas: T[];
  onChange: (linhas: T[]) => void;
  nova: (linhas: T[]) => T;
}) {
  const grade = `${colunas.map((c) => c.largura).join(" ")} auto`;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted" style={{ gridTemplateColumns: grade }}>
        {colunas.map((c) => (
          <span key={c.chave}>{c.titulo}</span>
        ))}
        <span />
      </div>
      {linhas.map((linha, i) => (
        <div key={i} className="grid items-start gap-2" style={{ gridTemplateColumns: grade }}>
          {colunas.map((c) => (
            <input
              key={c.chave}
              aria-label={c.titulo}
              className={fieldClass}
              value={String((linha as Record<string, unknown>)[c.chave] ?? "")}
              onChange={(e) => onChange(linhas.map((l, j) => (j === i ? { ...l, [c.chave]: e.target.value } : l)))}
            />
          ))}
          <Button variant="quiet" aria-label="Tirar linha" onClick={() => onChange(linhas.filter((_, j) => j !== i))}>
            Tirar
          </Button>
        </div>
      ))}
      <Button variant="quiet" className="-ml-2" onClick={() => onChange([...linhas, nova(linhas)])}>
        + Acrescentar linha
      </Button>
    </div>
  );
}

/** Próximo código da sequência: E01, E02... */
export function proximoId(prefixo: string, existentes: Array<{ id: string }>): string {
  const maior = existentes.reduce((m, e) => Math.max(m, Number(e.id.replace(/\D/g, "")) || 0), 0);
  return `${prefixo}${String(maior + 1).padStart(2, "0")}`;
}
