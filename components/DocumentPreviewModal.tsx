"use client";

import { useRef } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Status";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";

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

export function DocumentPreviewModal({ preview, onClose }: DocumentPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useDialogKeyboard(!!preview, onClose, dialogRef, fecharRef);

  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/45 p-4"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-titulo"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-gray-200 bg-surface-card shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="preview-titulo" className="font-display text-lg text-ink">
              Visualizar documento
            </h2>
            <p className="mt-0.5 break-words text-sm text-ink-muted">{preview.title}</p>
          </div>
          <button ref={fecharRef} type="button" onClick={onClose} className={buttonClass("secondary")}>
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-surface-subtle p-4 sm:p-6">
          <div className="mx-auto min-h-[70vh] max-w-[860px] rounded-md bg-surface-paper px-6 py-8 shadow-sm sm:px-8 sm:py-10">
            <div aria-live="polite">
              {preview.loading && <p className="text-sm text-ink-muted">Carregando preview...</p>}
              {!preview.loading && preview.error && (
                <Feedback tone="erro">{preview.error}</Feedback>
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
