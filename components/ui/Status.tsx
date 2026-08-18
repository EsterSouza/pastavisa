import type { ReactNode } from "react";

export type Tone = "neutro" | "info" | "sucesso" | "atencao" | "erro";

// Cor nunca é o único sinal: cada tom carrega rótulo em texto e um símbolo
// redundante (docs/DESIGN.md). Os tokens fortes trocam de valor no tema escuro.
const TONE_SURFACE: Record<Tone, string> = {
  neutro: "border-gray-300 bg-surface-subtle text-ink-muted",
  info: "border-brand-focus bg-surface-subtle text-brand-accent",
  sucesso: "border-status-success bg-status-success-soft text-status-success",
  atencao: "border-status-warning bg-status-warning-soft text-status-warning",
  erro: "border-status-danger bg-status-danger-soft text-status-danger",
};

const TONE_SYMBOL: Record<Tone, string> = {
  neutro: "◦",
  info: "•",
  sucesso: "✓",
  atencao: "!",
  erro: "×",
};

const TONE_BAR: Record<Tone, string> = {
  neutro: "bg-ink-subtle",
  info: "bg-brand-action",
  sucesso: "bg-status-success",
  atencao: "bg-status-warning",
  erro: "bg-status-danger",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${TONE_SURFACE[tone]}`}>
      <span aria-hidden="true">{TONE_SYMBOL[tone]}</span>
      {children}
    </span>
  );
}

/** Bloco de mensagem: erro, atenção, sucesso ou orientação. */
export function Feedback({
  tone,
  title,
  children,
  live,
  className = "",
}: {
  tone: Tone;
  title?: string;
  children?: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className={`rounded-md border px-4 py-3 text-sm ${TONE_SURFACE[tone]} ${className}`}
    >
      {title && (
        <p className="font-semibold">
          <span aria-hidden="true">{TONE_SYMBOL[tone]} </span>
          {title}
        </p>
      )}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, label, tone = "info" }: { value: number; label: string; tone?: Tone }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
    >
      <div className={`h-full transition-all ${TONE_BAR[tone]}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export interface StatusInfo {
  label: string;
  tone: Tone;
}

export const PASTA_STATUS: Record<string, StatusInfo> = {
  rascunho: { label: "Rascunho", tone: "neutro" },
  processando: { label: "Processando", tone: "info" },
  concluida: { label: "Concluída", tone: "sucesso" },
};

export const DOCUMENTO_STATUS: Record<string, StatusInfo> = {
  pendente: { label: "Pendente", tone: "neutro" },
  processando: { label: "Processando", tone: "info" },
  gerado: { label: "Gerado", tone: "sucesso" },
  erro: { label: "Erro", tone: "erro" },
};

export const UPLOAD_STATUS: Record<string, StatusInfo> = {
  // `pendente` é o padrão do banco: arquivo enviado, nenhuma rodada aplicada.
  pendente: { label: "Enviado", tone: "neutro" },
  processando: { label: "Processando", tone: "info" },
  processado: { label: "Processado", tone: "sucesso" },
  restaurado: { label: "Restaurado", tone: "atencao" },
  erro: { label: "Erro", tone: "erro" },
};

export function statusInfo(mapa: Record<string, StatusInfo>, status: string, padrao: StatusInfo): StatusInfo {
  return mapa[status] || padrao;
}

export type ErrorOrigin = "template" | "logo" | "upload" | "banco" | "geracao";

const ORIGIN_LABEL: Record<ErrorOrigin, string> = {
  template: "Falha no template",
  logo: "Falha na logo",
  upload: "Falha no upload",
  banco: "Falha no banco",
  geracao: "Falha na geração",
};

/**
 * Toda falha exibida nomeia onde ela aconteceu. O operador precisa saber se
 * troca o template, reenvia a logo, sobe o arquivo de novo, avisa sobre o banco
 * ou apenas tenta gerar outra vez — "erro desconhecido" não decide nada disso.
 * A mensagem crua continua visível: a classificação orienta, não substitui.
 */
export function describeErrorOrigin(mensagem: string): { origem: ErrorOrigin; rotulo: string } {
  // Radicais sem acento de propósito: assim "persistência" e "migração" casam
  // sem precisar normalizar a mensagem inteira.
  const texto = mensagem.toLowerCase();

  const origem: ErrorOrigin =
    /template/.test(texto) ? "template"
    : /logo/.test(texto) ? "logo"
    : /upload|envi|storage/.test(texto) ? "upload"
    : /banco|prisma|persist|database|migra|coluna/.test(texto) ? "banco"
    : "geracao";

  return { origem, rotulo: ORIGIN_LABEL[origem] };
}
