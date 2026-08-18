import fs from "node:fs/promises";
import path from "node:path";

/**
 * Ativos de marca usados na composição do PDF: a logo oficial para superfície escura
 * e as duas famílias do Manual de Marca TreinaVISA 2.0 — Sora para título e
 * Source Sans 3 para leitura. Sem elas o PDF ainda sai, com a fallback de escritório.
 */
export interface BrandAssets {
  logo?: Uint8Array;
  display?: Uint8Array;
  displayStrong?: Uint8Array;
  body?: Uint8Array;
  bodyStrong?: Uint8Array;
}

const FILES: Record<keyof BrandAssets, string> = {
  logo: "public/brand/treinavisa-logo-print.png",
  display: "public/brand/fonts/Sora-Medium.ttf",
  displayStrong: "public/brand/fonts/Sora-SemiBold.ttf",
  body: "public/brand/fonts/SourceSans3-Regular.ttf",
  bodyStrong: "public/brand/fonts/SourceSans3-SemiBold.ttf",
};

let cache: Promise<BrandAssets> | null = null;

async function readAsset(file: string): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(await fs.readFile(path.join(process.cwd(), file)));
  } catch {
    return undefined;
  }
}

export function loadBrandAssets(): Promise<BrandAssets> {
  cache ??= (async () => {
    const entries = Object.entries(FILES) as Array<[keyof BrandAssets, string]>;
    const loaded = await Promise.all(entries.map(async ([key, file]) => [key, await readAsset(file)] as const));
    return Object.fromEntries(loaded.filter(([, value]) => value)) as BrandAssets;
  })();
  return cache;
}
