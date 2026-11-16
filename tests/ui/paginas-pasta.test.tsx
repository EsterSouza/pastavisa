// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PaginasPasta } from "@/components/pasta/PaginasPasta";

const contagem = {
  id: "c1",
  versao: "Digital + Colorida",
  paginas: 439,
  documentos: JSON.stringify([{ nome: "MBP", paginas: 439 }]),
  contadaEm: "2026-11-16T19:56:24.851Z",
};

describe("card de páginas: data de impressão", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mostra o dia da impressão com o ciclo e grava a data trocada", async () => {
    const chamadas: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        chamadas.push({ url, init });
        if (init?.method === "PATCH") {
          return new Response(JSON.stringify({ contagem: { ...contagem, contadaEm: "2026-08-28T15:00:00.000Z" } }));
        }
        if (url === "/api/impressoes") return new Response(JSON.stringify({ contagens: [contagem] }));
        return new Response(JSON.stringify({ contagem }));
      })
    );

    render(<PaginasPasta pastaId="p1" />);
    const campo = await screen.findByLabelText("Impressa em");
    expect(campo).toHaveValue("2026-11-16");
    expect(screen.getByText(/21\/10 a 20\/11\/2026/)).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: "2026-08-28" } });
    await waitFor(() => expect(screen.getByText(/21\/08 a 20\/09\/2026/)).toBeInTheDocument());
    const patch = chamadas.find((c) => c.init?.method === "PATCH");
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ impressaEm: "2026-08-28" });
  });
});
