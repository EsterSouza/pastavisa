/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "better-sqlite3"],
    // A rota de PDF lê a logo e as fontes da marca em disco; sem isto elas não
    // entram no pacote da função e o PDF sairia com a fallback de escritório.
    outputFileTracingIncludes: {
      "/api/planejamento-comercial/pdf": [
        "./public/brand/treinavisa-logo-print.png",
        "./public/brand/fonts/*.ttf",
      ],
      // O DOCX do planejamento é montado sobre este modelo, lido em disco.
      "/api/planejamento/docx": ["./assets/planejamento/*.docx"],
    },
  },
};

export default nextConfig;
