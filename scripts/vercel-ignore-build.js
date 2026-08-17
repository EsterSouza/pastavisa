#!/usr/bin/env node
// Ignored Build Step da Vercel, referenciado por `ignoreCommand` no vercel.json.
//
// Contrato da Vercel, ao contrario do que a intuicao sugere:
//   exit 0  => a Vercel IGNORA o build
//   exit 1  => a Vercel SEGUE com o build
//
// Regra: so ignora quando o diff toca exclusivamente documentacao.
//
// Toda duvida resolve para BUILD, nunca para skip. Build extra custa minutos e
// aparece; deploy que nao acontece passa despercebido e deixa producao atras do
// repositorio. Este script existe porque `[skip ci]` na mensagem de commit nao
// era respeitado neste projeto e ninguem notou por dias (PV-020).

const { execFileSync } = require("node:child_process");

// Um arquivo e "documentacao" se casar com qualquer um destes.
const DOC_PATTERNS = [/^docs\//, /\.md$/i];

const IGNORE_BUILD = 0;
const RUN_BUILD = 1;

function decide() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (!previous) {
    console.log("VERCEL_GIT_PREVIOUS_SHA ausente; seguindo com o build.");
    return RUN_BUILD;
  }

  let changed;
  try {
    changed = execFileSync("git", ["diff", "--name-only", previous, "HEAD"], {
      encoding: "utf8",
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    // Clone raso pode nao conter o SHA anterior. Falha aqui nao autoriza skip.
    console.log(`git diff falhou (${error.message}); seguindo com o build.`);
    return RUN_BUILD;
  }

  if (changed.length === 0) {
    console.log(`Nenhum arquivo alterado desde ${previous}; seguindo com o build.`);
    return RUN_BUILD;
  }

  const naoDocumentacao = changed.filter(
    (file) => !DOC_PATTERNS.some((pattern) => pattern.test(file))
  );

  if (naoDocumentacao.length > 0) {
    console.log(
      `${naoDocumentacao.length} de ${changed.length} arquivo(s) fora de documentacao; build necessario:`
    );
    for (const file of naoDocumentacao.slice(0, 10)) console.log(`  ${file}`);
    if (naoDocumentacao.length > 10) {
      console.log(`  ... e outros ${naoDocumentacao.length - 10}`);
    }
    return RUN_BUILD;
  }

  console.log(
    `${changed.length} arquivo(s) alterado(s), todos de documentacao; build ignorado.`
  );
  for (const file of changed.slice(0, 10)) console.log(`  ${file}`);
  return IGNORE_BUILD;
}

process.exit(decide());
