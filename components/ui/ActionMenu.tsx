"use client";

import { useEffect, useRef, useState } from "react";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  destrutiva?: boolean;
  disabled?: boolean;
}

/**
 * Menu "⋯" para ações secundárias de uma linha. Tira Remover, Visualizar e
 * afins da linha, que antes quebrava em duas quando o nome era longo.
 */
export function ActionMenu({
  label,
  items,
  disabled = false,
  variant = "quiet",
}: {
  label: string;
  items: ActionMenuItem[];
  disabled?: boolean;
  /** "secondary" ganha borda, para ficar ao lado de botões no cabeçalho. */
  variant?: "quiet" | "secondary";
}) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();

    function onPointerDown(event: MouseEvent) {
      if (!raizRef.current?.contains(event.target as Node)) setAberto(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const opcoes = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      if (opcoes.length === 0) return;
      event.preventDefault();
      const atual = opcoes.indexOf(document.activeElement as HTMLButtonElement);
      const passo = event.key === "ArrowDown" ? 1 : -1;
      opcoes[(atual + passo + opcoes.length) % opcoes.length].focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto]);

  return (
    <div ref={raizRef} className="relative">
      <button
        ref={botaoRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-lg font-semibold leading-none hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent ${
          variant === "secondary" ? "border border-gray-300 bg-surface-card text-ink shadow-sm" : "text-brand-accent"
        }`}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {aberto && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-popover mt-1 min-w-[13rem] rounded-md border border-gray-200 bg-surface-card p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setAberto(false);
                item.onSelect();
              }}
              className={`flex min-h-10 w-full items-center whitespace-nowrap rounded px-3 text-left text-sm font-semibold hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent ${
                item.destrutiva ? "text-status-danger" : "text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
