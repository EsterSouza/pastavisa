import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-brand-action text-white hover:bg-brand-navy disabled:bg-brand-action/50",
    secondary: "border border-gray-300 bg-surface-card text-ink hover:bg-surface-subtle disabled:text-ink-muted",
  };

  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${className}`}
    />
  );
}
