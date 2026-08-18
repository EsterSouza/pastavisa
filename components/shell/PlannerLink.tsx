"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Link do pré-planejamento comercial, para o comercial copiar e mandar ao cliente.
 *
 * É um campo de cópia, não um item de navegação: `/planner` é público e sem login
 * (regra global 7 do handoff), e pôr um link no menu interno daria a ele uma porta
 * de entrada autenticada. O campo é somente-leitura em vez de só um botão porque
 * `navigator.clipboard` não existe fora de contexto seguro — aí a URL ainda pode
 * ser selecionada à mão.
 */
export function PlannerLink() {
  const [url, setUrl] = useState("/planner");
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // A origem só existe no navegador; no servidor ficaria o caminho relativo, que
  // não serve para colar em uma conversa com o cliente.
  useEffect(() => {
    setUrl(`${window.location.origin}/planner`);
  }, []);

  useEffect(() => {
    if (!copiado) return;
    const timer = window.setTimeout(() => setCopiado(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copiado]);

  async function copiar() {
    campo.current?.select();
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Sem clipboard: o texto ficou selecionado e o comercial copia no teclado.
      setCopiado(false);
    }
  }

  return (
    <div className="mt-6 rounded-md border border-shell-border p-3">
      <p className="text-sm font-semibold text-shell-text">Pré-planejamento comercial</p>
      <p className="mt-1 text-xs text-shell-muted">
        Página pública, sem login. Copie e envie ao cliente.
      </p>
      <div className="mt-2 flex gap-1">
        <input
          ref={campo}
          readOnly
          value={url}
          aria-label="Link do pré-planejamento comercial"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-shell-border bg-shell-hover px-2 py-1.5 text-xs text-shell-text"
        />
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 rounded-md border border-shell-border px-2 py-1.5 text-xs font-semibold text-shell-text hover:bg-shell-hover"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copiado ? "Link copiado" : ""}
      </span>
    </div>
  );
}
