"use client";

import { useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";

/**
 * Painel lateral para tarefas de apoio (revisar legislações, importar). A tela
 * principal continua visível atrás, e o painel não empurra a lista para baixo.
 */
export function Drawer({
  aberto,
  titulo,
  descricao,
  onClose,
  children,
  rodape,
  largura = "md",
}: {
  aberto: boolean;
  titulo: string;
  descricao?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  /** "lg" para conteúdo em grade, como a biblioteca de variáveis. */
  largura?: "md" | "lg";
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard(aberto, onClose, painelRef, fecharRef);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex justify-end bg-black/45"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-titulo"
        className={`flex h-full w-full ${largura === "lg" ? "max-w-3xl" : "max-w-xl"} flex-col border-l border-gray-200 bg-surface-card shadow-lg`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-titulo" className="font-display text-lg text-ink">
              {titulo}
            </h2>
            {descricao && <div className="mt-1 text-sm text-ink-muted">{descricao}</div>}
          </div>
          <button ref={fecharRef} type="button" onClick={onClose} className={buttonClass("secondary")}>
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="border-t border-gray-200 px-5 py-4">{rodape}</div>}
      </div>
    </div>
  );
}
