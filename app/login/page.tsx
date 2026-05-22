"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Usuario ou senha invalidos.");
      return;
    }

    const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center">
      <form onSubmit={handleSubmit} className="w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Entrar no PastaVISA</h1>
          <p className="mt-1 text-sm text-gray-500">Acesse para continuar gerando documentos.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-medium text-gray-700">Usuario</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-700">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
