import type { ReactNode } from "react";

/** Superfície padrão de conteúdo: borda discreta, raio moderado, sem sombra decorativa. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-gray-200 bg-surface-card ${className}`}>{children}</div>;
}

interface CardHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}

export function CardHeader({ title, description, actions, meta }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h2 className="font-display text-base text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meta && <span className="text-sm text-ink-muted">{meta}</span>}
        {actions}
      </div>
    </div>
  );
}

/** Seção de formulário: um título por bloco, para que o formulário longo continue navegável. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-surface-card p-4 sm:p-5">
      <h2 className="font-display text-base text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-surface-card px-5 py-10 text-center">
      <p className="font-display text-base text-ink">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
