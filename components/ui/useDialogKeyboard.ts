"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Enquanto um diálogo está aberto ele é a única coisa navegável: Esc fecha, o foco
 * entra no controle indicado, o Tab circula dentro do diálogo e, ao fechar, o foco
 * volta para o elemento que abriu. Compartilhado pelo preview e pelas confirmações
 * destrutivas — sem isso o operador de teclado tabula a página por baixo de um
 * modal que não consegue fechar.
 */
export function useDialogKeyboard(
  aberto: boolean,
  onClose: () => void,
  dialogRef: RefObject<HTMLElement>,
  focoInicialRef: RefObject<HTMLElement>
) {
  useEffect(() => {
    if (!aberto) return;

    const anterior = document.activeElement as HTMLElement | null;
    focoInicialRef.current?.focus();

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
  }, [aberto, onClose, dialogRef, focoInicialRef]);
}
