/**
 * Cor de fundo de uma logo, lida da borda da imagem no navegador.
 *
 * Devolve `#RRGGBB` quando a borda é de uma cor só (a logo veio com fundo). Devolve
 * null quando a borda é transparente ou misturada: aí não há fundo para pintar no
 * cabeçalho e o campo fica como está.
 */
export async function detectarFundoLogo(arquivo: File): Promise<string | null> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("imagem ilegível"));
      el.src = url;
    });

    const escala = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const borda: Array<[number, number, number, number]> = [];
    const pegar = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      borda.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
    };
    for (let x = 0; x < w; x++) {
      pegar(x, 0);
      pegar(x, h - 1);
    }
    for (let y = 1; y < h - 1; y++) {
      pegar(0, y);
      pegar(w - 1, y);
    }

    const transparentes = borda.filter((p) => p[3] < 200).length;
    if (transparentes > borda.length * 0.2) return null;

    // Cor mais comum na borda (agrupada em faixas de 16) e quanto da borda ela cobre.
    const contagem = new Map<string, number>();
    for (const [r, g, b] of borda) {
      const chave = `${r >> 4},${g >> 4},${b >> 4}`;
      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
    const [moda] = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1]);
    const [mr, mg, mb] = moda[0].split(",").map((n) => Number(n) * 16 + 8);
    const iguais = borda.filter(
      ([r, g, b, a]) => a >= 200 && Math.abs(r - mr) <= 24 && Math.abs(g - mg) <= 24 && Math.abs(b - mb) <= 24
    );
    if (iguais.length < borda.length * 0.7) return null;

    const media = (k: 0 | 1 | 2) => Math.round(iguais.reduce((soma, p) => soma + p[k], 0) / iguais.length);
    return `#${[media(0), media(1), media(2)].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
