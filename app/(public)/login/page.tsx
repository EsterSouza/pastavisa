"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="m-auto grid w-full max-w-4xl overflow-hidden rounded-lg border border-gray-200 bg-surface-card shadow-sm md:grid-cols-[0.9fr_1.1fr]">
      <div className="bg-brand-deep p-7 text-white sm:p-10">
        <p className="font-display text-2xl leading-tight">Pasta Sanitária</p>
        <p className="mt-3 max-w-sm text-base leading-7 text-brand-pale">
          Documentação sanitária organizada para apoiar decisões e práticas aplicáveis à rotina.
        </p>
        <p className="mt-10 text-sm font-medium text-brand-focus">Da exigência à prática, com clareza.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-7 sm:p-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-medium text-ink">Acesse sua área</h1>
          <p className="mt-2 text-base leading-6 text-ink-muted">Use suas credenciais para continuar.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ink">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={error ? "email-hint login-error" : "email-hint"}
              className="w-full rounded-md border border-gray-300 bg-white px-3 text-base text-ink placeholder:text-ink-subtle focus:border-brand-focus focus:ring-2 focus:ring-brand-focus/30"
              required
            />
            <p id="email-hint" className="mt-1.5 text-sm text-ink-muted">Digite o e-mail completo cadastrado.</p>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-ink">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={error ? "login-error" : undefined}
              className="w-full rounded-md border border-gray-300 bg-white px-3 text-base text-ink focus:border-brand-focus focus:ring-2 focus:ring-brand-focus/30"
              required
            />
          </div>

          {error && (
            <p id="login-error" role="alert" className="rounded-md border border-status-danger bg-status-danger-soft px-3 py-2 text-sm font-medium text-status-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </div>
      </form>
    </section>
  );
}
