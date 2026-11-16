"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/auth/next-path";

const ERROS: Record<string, string> = {
  "sem-acesso": "Sua conta não tem acesso à Pasta Sanitária. Fale com a administração.",
  cancelado: "O login foi cancelado.",
  expirado: "O login demorou demais. Tente de novo.",
  falhou: "Não foi possível entrar. Tente novamente.",
};

export default function LoginPage() {
  const [href, setHref] = useState("/api/auth/login");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeNextPath(params.get("next"));
    setHref(`/api/auth/login?next=${encodeURIComponent(next)}`);
    const erro = params.get("erro");
    if (erro) setError(ERROS[erro] || ERROS.falhou);
  }, []);

  return (
    <section className="m-auto grid w-full max-w-4xl overflow-hidden rounded-lg border border-gray-200 bg-surface-card shadow-sm md:grid-cols-[0.9fr_1.1fr]">
      <div className="bg-brand-deep p-7 text-white sm:p-10">
        <p className="font-display text-2xl leading-tight">Pasta Sanitária</p>
        <p className="mt-3 max-w-sm text-base leading-7 text-brand-pale">
          Documentação sanitária organizada para apoiar decisões e práticas aplicáveis à rotina.
        </p>
        <p className="mt-10 text-sm font-medium text-brand-focus">Da exigência à prática, com clareza.</p>
      </div>

      <div className="p-7 sm:p-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-medium text-ink">Acesse sua área</h1>
          <p className="mt-2 text-base leading-6 text-ink-muted">
            O acesso é pela conta Treinavisa, a mesma dos outros sistemas.
          </p>
        </div>

        <div className="space-y-5">
          {error && (
            <p id="login-error" role="alert" className="rounded-md border border-status-danger bg-status-danger-soft px-3 py-2 text-sm font-medium text-status-danger">
              {error}
            </p>
          )}

          <a
            href={href}
            className={buttonClass("primary", "w-full")}
          >
            Entrar com a conta Treinavisa
          </a>
        </div>
      </div>
    </section>
  );
}
