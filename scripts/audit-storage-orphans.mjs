#!/usr/bin/env node
/**
 * Limpeza dos arquivos órfãos do Supabase Storage (PV-026).
 *
 * Órfão é o objeto que nenhuma linha do banco referencia. Ele não aparece em
 * tela nenhuma, não pode ser baixado por ninguém e mesmo assim ocupa cota e
 * mantém documento de cliente guardado.
 *
 * Duas fontes de órfão, ambas medidas em 19/08/2026:
 *   1. `DELETE /api/pastas/[id]` apaga as saídas e deixa o arquivo que o cliente
 *      enviou — `deleteGeneratedDocx` só remove sob `storage/output`.
 *   2. A exclusão em lote de documentos de correção faz o mesmo, e está
 *      documentada em comentário na própria rota.
 *
 * ## Por que este script recebe uma lista em vez de descobrir sozinho
 *
 * As tabelas de `public` têm grant **só para `postgres`** — nem `anon`, nem
 * `authenticated`, nem `service_role`. É a postura que o PV-002 estabeleceu: o
 * acervo de documentos de cliente não é alcançável pela API REST, seja qual for
 * a chave. Quem lê essas tabelas é o Prisma da aplicação, que conecta como
 * `postgres` com a senha do banco.
 *
 * Dar `SELECT` a `service_role` só para rodar uma faxina abriria por HTTPS todo
 * o acervo a quem tiver a chave. Não vale o preço, então quem determina o que é
 * órfão é uma consulta feita com acesso privilegiado, fora daqui, e o resultado
 * chega como manifesto.
 *
 * `storage.objects`, essa sim, dá grant a `service_role` — por isso listar e
 * apagar funciona com a chave de serviço.
 *
 * ## O manifesto é dado, não ordem
 *
 * O script não confia na lista que recebe. Antes de apagar qualquer coisa ele
 * confere, contra o próprio bucket, que cada caminho existe, que está fora de
 * `output/` e `templates/`, e que é velho o bastante. Caminho que não passa por
 * essas conferências não é apagado, esteja no manifesto ou não.
 *
 * ## Uso
 *
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
 *   node scripts/audit-storage-orphans.mjs --manifesto orfaos-2026-08-19.txt
 *   node scripts/audit-storage-orphans.mjs --manifesto orfaos-2026-08-19.txt --apply
 *
 * A chave não precisa tocar o disco: a variável de sessão morre com o terminal.
 * Cuidado com `>` no PowerShell 5.1 — grava em UTF-16 e o `dotenv` lê como lixo.
 *
 * Sem `--apply` nada é removido: o padrão é sempre a leitura.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

function argumento(nome, padrao = null) {
  const i = process.argv.indexOf(nome);
  if (i === -1) return padrao;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith("--")) {
    console.error(`${nome} exige um valor.`);
    process.exit(1);
  }
  return valor;
}

const APPLY = process.argv.includes("--apply");
const CAMINHO_MANIFESTO = argumento("--manifesto");
const IDADE_MINIMA_HORAS = Number(argumento("--idade-minima-horas", "24"));
const VALIDADE_HORAS = Number(argumento("--validade-horas", "2"));

if (!CAMINHO_MANIFESTO) {
  console.error(
    "Informe o manifesto: --manifesto orfaos-AAAA-MM-DD.txt\n" +
      "Ele e gerado por consulta privilegiada ao banco, fora deste script."
  );
  process.exit(1);
}
for (const [nome, valor] of [
  ["--idade-minima-horas", IDADE_MINIMA_HORAS],
  ["--validade-horas", VALIDADE_HORAS],
]) {
  if (!Number.isFinite(valor) || valor < 0) {
    console.error(`${nome} exige um numero de horas.`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Defina SUPABASE_SERVICE_ROLE_KEY (Supabase -> Project Settings -> API Keys -> service_role).\n" +
      'No PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY = "..."'
  );
  process.exit(1);
}
if (/^\[SENSITIVE\]$/.test(serviceRoleKey)) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY veio como [SENSITIVE]: a Vercel nao devolve variavel sensivel.\n" +
      "Pegue a chave no painel do Supabase."
  );
  process.exit(1);
}

// A chave publicável e a de serviço são fáceis de trocar, e a publicável não
// enxerga o bucket. Sem esta conferência o erro apareceria como "0 objetos",
// indistinguível de bucket já limpo — o pior jeito de errar aqui.
const papel = (() => {
  const partes = serviceRoleKey.split(".");
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
})();
if (papel && papel !== "service_role") {
  console.error(`A chave informada tem papel "${papel}", nao "service_role".`);
  process.exit(1);
}

function mb(bytes) {
  return `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Áreas de onde este script pode remover. `output/` guarda documento vivo de
 * pasta existente e `templates/` é o acervo oficial: nenhum dos dois sai por
 * aqui, nem que o manifesto peça.
 */
const AREAS_PERMITIDAS = new Set(["uploads", "logos"]);

function lerManifesto(caminho) {
  const absoluto = path.resolve(root, caminho);
  if (!fs.existsSync(absoluto)) {
    console.error(`Manifesto nao encontrado: ${caminho}`);
    process.exit(1);
  }

  const linhas = fs.readFileSync(absoluto, "utf8").split(/\r?\n/);
  const cabecalho = {};
  const caminhos = [];

  for (const linha of linhas) {
    const texto = linha.trim();
    if (!texto) continue;
    if (texto.startsWith("#")) {
      const [, chave, valor] = texto.match(/^#\s*([\w-]+)\s*:\s*(.+)$/) || [];
      if (chave) cabecalho[chave] = valor.trim();
      continue;
    }
    caminhos.push(texto);
  }

  if (!cabecalho["gerado-em"]) {
    console.error("O manifesto nao diz quando foi gerado (# gerado-em: ...). Recusado.");
    process.exit(1);
  }
  const idadeHoras = (Date.now() - new Date(cabecalho["gerado-em"]).getTime()) / 3_600_000;
  if (!Number.isFinite(idadeHoras)) {
    console.error(`Data invalida no manifesto: ${cabecalho["gerado-em"]}`);
    process.exit(1);
  }
  if (idadeHoras > VALIDADE_HORAS) {
    console.error(
      `Manifesto gerado ha ${idadeHoras.toFixed(1)}h, acima do limite de ${VALIDADE_HORAS}h.\n` +
        "Entre a consulta e a remocao o banco pode ter mudado. Gere um manifesto novo."
    );
    process.exit(1);
  }

  const unicos = [...new Set(caminhos)];

  // Selo de integridade: md5 dos caminhos em ordem de byte, calculado pela mesma
  // consulta que gerou o manifesto. Uma linha editada, acrescentada ou perdida
  // muda o selo, e o script para em vez de apagar o que alguem escreveu a mao.
  const selo = cabecalho["md5-caminhos"];
  if (!selo) {
    console.error("O manifesto nao traz # md5-caminhos. Sem selo eu nao apago nada.");
    process.exit(1);
  }
  const calculado = crypto
    .createHash("md5")
    .update([...unicos].sort().join(String.fromCharCode(10)))
    .digest("hex");
  if (calculado !== selo) {
    console.error("PARADO: o selo do manifesto nao confere.");
    console.error(`  declarado: ${selo}`);
    console.error(`  calculado: ${calculado}`);
    console.error("O arquivo foi alterado depois de gerado. Gere um manifesto novo.");
    process.exit(1);
  }

  return { cabecalho, caminhos: unicos };
}

/** Percorre o bucket inteiro. `list` só devolve um nível por vez, e em páginas. */
async function listarObjetos(prefixo = "") {
  const encontrados = [];
  const passo = 1000;

  for (let inicio = 0; ; inicio += passo) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefixo, { limit: passo, offset: inicio });
    if (error) throw new Error(`Falha ao listar ${prefixo || "/"}: ${error.message}`);

    for (const item of data) {
      const nome = prefixo ? `${prefixo}/${item.name}` : item.name;
      // Pasta não tem id; é o único jeito de distingui-la de arquivo.
      if (item.id === null) encontrados.push(...(await listarObjetos(nome)));
      else
        encontrados.push({
          name: nome,
          bytes: BigInt(item.metadata?.size ?? 0),
          created_at: item.created_at,
        });
    }

    if (data.length < passo) return encontrados;
  }
}

async function main() {
  const { cabecalho, caminhos } = lerManifesto(CAMINHO_MANIFESTO);
  console.log(`\nManifesto: ${caminhos.length} caminhos, gerado em ${cabecalho["gerado-em"]}`);
  if (cabecalho.origem) console.log(`Origem: ${cabecalho.origem}`);
  console.log(`Selo conferido: ${cabecalho["md5-caminhos"]}`);

  const objetos = await listarObjetos();
  const porNome = new Map(objetos.map((o) => [o.name, o]));
  const totalBytes = objetos.reduce((soma, o) => soma + o.bytes, 0n);
  console.log(`Bucket ${bucket}: ${objetos.length} objetos, ${mb(totalBytes)}\n`);

  const aprovados = [];
  const recusados = { ausente: 0, area: 0, recente: 0 };

  for (const caminho of caminhos) {
    const objeto = porNome.get(caminho);
    // Já não existe: outra execução apagou, ou o manifesto está velho.
    if (!objeto) {
      recusados.ausente += 1;
      continue;
    }
    // O manifesto é dado de entrada, não ordem: nem que ele peça, `output/` e
    // `templates/` não saem por aqui.
    if (!AREAS_PERMITIDAS.has(caminho.split("/")[1])) {
      recusados.area += 1;
      continue;
    }
    // Envio em andamento existe no Storage antes de a linha do banco ser
    // gravada. A idade vem do bucket, não do manifesto.
    if ((Date.now() - new Date(objeto.created_at).getTime()) / 3_600_000 < IDADE_MINIMA_HORAS) {
      recusados.recente += 1;
      continue;
    }
    aprovados.push(objeto);
  }

  const bytesAprovados = aprovados.reduce((soma, o) => soma + o.bytes, 0n);
  const porcento = totalBytes ? ((Number(bytesAprovados) / Number(totalBytes)) * 100).toFixed(0) : "0";
  console.log(
    `  Aprovados para remocao: ${aprovados.length} objetos, ${mb(bytesAprovados)} (${porcento}% do bucket)`
  );
  if (recusados.ausente) console.log(`  Recusados por nao existirem mais no bucket: ${recusados.ausente}`);
  if (recusados.area) console.log(`  Recusados por estarem fora de uploads/ e logos/: ${recusados.area}`);
  if (recusados.recente) console.log(`  Recusados por terem menos de ${IDADE_MINIMA_HORAS}h: ${recusados.recente}`);

  const esperados = Number(cabecalho.objetos);
  if (Number.isFinite(esperados) && esperados !== aprovados.length) {
    console.log(
      `\n  Atencao: o manifesto anunciava ${esperados} objetos e ${aprovados.length} passaram nas conferencias.`
    );
  }

  if (!APPLY) {
    console.log("\n  Nada foi removido. Rode de novo com --apply para apagar.\n");
    return;
  }
  if (!aprovados.length) {
    console.log("\n  Nada aprovado para remocao.\n");
    return;
  }

  let removidos = 0;
  for (let i = 0; i < aprovados.length; i += 100) {
    const lote = aprovados.slice(i, i + 100).map((o) => o.name);
    const { error } = await supabase.storage.from(bucket).remove(lote);
    if (error) throw new Error(`Falha ao remover lote ${Math.floor(i / 100) + 1}: ${error.message}`);
    removidos += lote.length;
    console.log(`  removidos ${removidos}/${aprovados.length}`);
  }
  console.log(`\n  ${removidos} objetos removidos, ${mb(bytesAprovados)} liberados.\n`);
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
