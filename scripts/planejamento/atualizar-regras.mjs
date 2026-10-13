// Copia as regras da skill "planejar-documentos-pastavisa" (a que a Ester usa no Cowork)
// para lib/planejamento/regras-skill.ts, que vai no prompt da IA do planejamento.
// Quando ela mudar a skill, rode de novo:
//   node scripts/planejamento/atualizar-regras.mjs "<pasta da skill>"
import fs from "node:fs";
import path from "node:path";

const pasta = process.argv[2];
if (!pasta || !fs.existsSync(path.join(pasta, "SKILL.md"))) {
  console.error('Uso: node scripts/planejamento/atualizar-regras.mjs "<pasta da skill planejar-documentos-pastavisa>"');
  process.exit(1);
}

const arquivos = [
  "SKILL.md",
  "references/padrao-documento.md",
  "references/regras-de-selecao.md",
  "references/catalogo-nomes.md",
  "references/acervo-templates.md",
  "references/referencias-normativas.md",
];
const texto = arquivos
  .map((nome) => `<<<ARQUIVO ${nome}>>>\n${fs.readFileSync(path.join(pasta, nome), "utf8").trim()}`)
  .join("\n\n");

const saida = path.join(process.cwd(), "lib/planejamento/regras-skill.ts");
fs.writeFileSync(
  saida,
  `// Gerado por scripts/planejamento/atualizar-regras.mjs a partir da skill do Cowork.\n` +
    `// Não editar à mão: mude a skill e rode o script de novo.\n` +
    `export const REGRAS_SKILL = ${JSON.stringify(texto)};\n`
);
console.log(`Regras copiadas (${texto.length} caracteres) para ${path.relative(process.cwd(), saida)}`);
