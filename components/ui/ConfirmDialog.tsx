"use client";

import { useRef, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Status";
import { useDialogKeyboard } from "@/components/ui/useDialogKeyboard";

interface ConfirmDialogProps {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string;
  destrutiva?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  busy = false,
  error,
  destrutiva = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // O foco entra no Cancelar: numa confirmação destrutiva, o caminho seguro é o
  // que fica sob a mão de quem só apertou Enter.
  useDialogKeyboard(true, onCancel, dialogRef, cancelarRef);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/45 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg border border-gray-200 bg-surface-card p-5 shadow-lg"
      >
        <h2 id="confirm-titulo" className="font-display text-lg text-ink">
          {title}
        </h2>
        {description && <div className="mt-2 text-sm text-ink-muted">{description}</div>}
        {children && <div className="mt-3 min-h-0 flex-1 overflow-y-auto">{children}</div>}
        {error && (
          <Feedback tone="erro" live className="mt-4">
            {error}
          </Feedback>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            ref={cancelarRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={buttonClass("secondary", "flex-1")}
          >
            {cancelLabel}
          </button>
          <Button
            variant={destrutiva ? "danger" : "primary"}
            className="flex-1"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
