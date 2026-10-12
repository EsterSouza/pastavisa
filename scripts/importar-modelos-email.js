/**
 * Copia os modelos de e-mail da Ester (os HTML de preencher, com o e-mail inteiro em
 * base64 dentro de `const TPL = ...atob("...")`) para lib/emails/modelos-html.ts.
 *
 * A logo vem embutida como data:image no modelo. O Gmail não mostra data:image em
 * e-mail recebido, então ela sai daqui para lib/emails/logo-treinavisa.ts e o modelo
 * passa a apontar para cid:logo-treinavisa (vai como anexo embutido no envio).
 *
 * Uso: node scripts/importar-modelos-email.js "<pasta com os .html>"
 */
const fs = require("fs");
const path = require("path");

const ARQUIVOS = {
  "boas-vindas": "PREENCHER-email-pasta-sanitaria.html",
  apreciacao: "MODELO-email-periodo-apreciacao.html",
  "entrega-fisica": "MODELO-email-entrega-digital-e-pasta-fisica.html",
  "entrega-digital": "MODELO-email-entrega-final-pasta-digital.html",
};

const pasta = process.argv[2];
if (!pasta) {
  console.error('Informe a pasta dos modelos: node scripts/importar-modelos-email.js "C:\\...\\Pasta Personalizada"');
  process.exit(1);
}

const LOGO = /data:image\/png;base64,([A-Za-z0-9+/=]+)/g;
let logo = null;
const modelos = {};

for (const [tipo, arquivo] of Object.entries(ARQUIVOS)) {
  const fonte = fs.readFileSync(path.join(pasta, arquivo), "utf8");
  const achado = fonte.match(/atob\("([A-Za-z0-9+/=]+)"\)/);
  if (!achado) throw new Error(`${arquivo}: não achei o modelo em base64 (const TPL).`);
  let html = Buffer.from(achado[1], "base64").toString("utf8");

  const imagens = [...html.matchAll(LOGO)].map((m) => m[1]);
  if (imagens.length !== 1) throw new Error(`${arquivo}: esperava 1 imagem embutida, achei ${imagens.length}.`);
  if (logo && logo !== imagens[0]) throw new Error(`${arquivo}: a logo é diferente da dos outros modelos.`);
  logo = imagens[0];
  html = html.replace(LOGO, "cid:logo-treinavisa");

  modelos[tipo] = html;
}

const destino = path.join(__dirname, "..", "lib", "emails");
fs.mkdirSync(destino, { recursive: true });
const aviso = "// Gerado por scripts/importar-modelos-email.js a partir dos modelos HTML da Ester. Não editar à mão.\n";
fs.writeFileSync(
  path.join(destino, "modelos-html.ts"),
  `${aviso}\nexport const MODELOS_HTML = ${JSON.stringify(modelos, null, 2)} as const;\n`
);
fs.writeFileSync(path.join(destino, "logo-treinavisa.ts"), `${aviso}\nexport const LOGO_TREINAVISA_PNG_BASE64 =\n  ${JSON.stringify(logo)};\n`);
console.log(`ok: ${Object.keys(modelos).length} modelos, logo com ${Math.round((logo.length * 3) / 4 / 1024)} KB`);
