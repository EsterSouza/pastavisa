"use client";

import { useEffect, useRef } from "react";

export interface DocumentPreviewState {
  title: string;
  html: string;
  loading: boolean;
  error?: string;
}

interface DocumentPreviewModalProps {
  preview: DocumentPreviewState | null;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DocumentPreviewModal({ preview, onClose }: DocumentPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const aberto = !!preview;

  // Enquanto o modal está aberto ele é a única coisa navegável: Esc fecha, o foco
  // entra no botão Fechar, o Tab circula dentro do diálogo e, ao fechar, o foco
  // volta para o elemento que abriu — sem isso o operador de teclado ficava
  // tabulando a lista de documentos por baixo de um modal que não conseguia fechar.
  useEffect(() => {
    if (!aberto) return;

    const anterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const foco = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (foco.length === 0) return;
      const primeiro = foco[0];
      const ultimo = foco[foco.length - 1];
      const ativo = document.activeElement;

      if (event.shiftKey && (ativo === primeiro || !dialogRef.current?.contains(ativo))) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && ativo === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      anterior?.focus?.();
    };
  }, [aberto, onClose]);

  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-titulo"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="preview-titulo" className="text-lg font-semibold text-gray-900">
              Visualizar documento
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{preview.title}</p>
          </div>
          <button
            ref={fecharRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-4 sm:p-6">
          <div className="mx-auto min-h-[70vh] max-w-[860px] rounded-lg bg-surface-paper px-8 py-10 shadow">
            <div aria-live="polite">
              {preview.loading && (
                <p className="text-sm text-gray-500">Carregando preview...</p>
              )}
              {!preview.loading && preview.error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {preview.error}
                </p>
              )}
            </div>
            {!preview.loading && !preview.error && (
              <div
                className="docx-preview-content"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
