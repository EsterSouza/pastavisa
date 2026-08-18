import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Ação principal é sempre azul de ação; âmbar nunca é CTA (docs/DESIGN.md).
export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-action text-brand-on-dark hover:bg-brand-navy disabled:bg-brand-action/50",
  secondary: "border border-gray-300 bg-surface-card text-ink hover:bg-surface-subtle disabled:text-ink-muted",
  danger: "border border-status-danger bg-surface-card text-status-danger hover:bg-status-danger-soft disabled:text-ink-subtle",
  quiet: "text-brand-accent underline-offset-4 hover:underline disabled:text-ink-subtle disabled:no-underline",
};

const BASE = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70";

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const shadow = variant === "quiet" ? "px-2" : "shadow-sm";
  return <button {...props} className={`${BASE} ${shadow} ${BUTTON_VARIANTS[variant]} ${className}`} />;
}

/** Mesma aparência do Button para links de navegação e download. */
export function buttonClass(variant: ButtonVariant = "primary", className = ""): string {
  const shadow = variant === "quiet" ? "px-2" : "shadow-sm";
  return `${BASE} ${shadow} ${BUTTON_VARIANTS[variant]} ${className}`;
}
