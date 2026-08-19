#!/usr/bin/env node
/**
 * Auditoria — e, sob pedido explícito, limpeza — de arquivos órfãos no Supabase
 * Storage (PV-026).
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
 * ## Por que só a chave de serviço, e nenhum DATABASE_URL
 *
 * A primeira versão pedia `DATABASE_URL`. Não dá: na Vercel ela está marcada
 * como **Sensitive**, e variável sensível é write-only — `vercel env pull`
 * devolve `[SENSITIVE]`, e a API também não a lê. Do lado do Supabase, a senha
 * do Postgres não é exibida depois da criação do projeto; só há reset, que
 * derrubaria a produção até a Vercel ser atualizada.
 *
 * A chave `service_role`, essa sim, é revelável no painel do Supabase. E ela
 * basta: as tabelas saem pela API REST e os objetos pela API de Storage.
 *
 * ## Uso
 *
 *   node scripts/audit-storage-orphans.mjs --env .env.limpeza              # só relatório
 *   node scripts/audit-storage-orphans.mjs --env .env.limpeza --manifesto  # grava a lista
 *   node scripts/audit-storage-orphans.mjs --env .env.limpeza --apply      # apaga
 *
 * O arquivo precisa de uma linha:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * **Use um arquivo separado, não o `.env.local`.** O `.env.local` é lido pelo
 * `next dev`, e chave de serviço não tem por que ficar ao alcance do servidor de
 * desenvolvimento.
 *
 * ### Sem arquivo nenhum — o caminho recomendado
 *
 * A chave não precisa tocar o disco. No PowerShell:
 *
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "..."
 *   node scripts/audit-storage-orphans.mjs
 *
 * A variável morre junto com o terminal, e não sobra arquivo para esquecer de
 * apagar. Cuidado com `>` no PowerShell 5.1: ele grava em UTF-16 e o `dotenv`
 * lê o resultado como lixo. Se for mesmo usar arquivo, `Set-Content -Encoding utf8`.
 *
 * Sem `--apply` nada é removido: o padrão é sempre a leitura.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const envIndex = process.argv.indexOf("--env");
if (envIndex !== -1) {
  const arquivo = process.argv[envIndex + 1];
  if (!arquivo) {
    console.error("--env exige o caminho do arquivo, por exemplo: --env .env.limpeza");
    process.exit(1);
  }
  const caminho = path.resolve(root, arquivo);
  if (!fs.existsSync(caminho)) {
    console.error(`Arquivo de ambiente nao encontrado: ${arquivo}`);
    process.exit(1);
  }
  dotenv.config({ path: caminho, override: true });
}

const APPLY = process.argv.includes("--apply");
const MANIFESTO = process.argv.includes("--manifesto") || APPLY;
// O acervo de templates é o insumo de toda pasta gerada. Um órfão ali é quase
// sempre envio interrompido, não lixo, então fica de fora por padrão.
const INCLUIR_TEMPLATES = process.argv.includes("--incluir-templates");

// Um envio em andamento existe no Storage antes de a linha do banco ser
// gravada. Sem este piso, uma corrida de segundos faria o arquivo recém-enviado
// de um cliente parecer órfão — e ser apagado.
const idadeIndex = process.argv.indexOf("--idade-minima-horas");
const IDADE_MINIMA_HORAS = idadeIndex === -1 ? 24 : Number(process.argv[idadeIndex + 1]);
if (!Number.isFinite(IDADE_MINIMA_HORAS) || IDADE_MINIMA_HORAS < 0) {
  console.error("--idade-minima-horas exige um numero de horas.");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "pasta-visa";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Defina SUPABASE_SERVICE_ROLE_KEY (painel do Supabase: Project Settings -> API Keys -> service_role)\n" +
      "e SUPABASE_URL, se ela ainda nao estiver no .env.local."
  );
  process.exit(1);
}
// A chave publicável e a de serviço são fáceis de trocar, e a publicável não lê
// nada aqui — RLS bloqueia tudo. Sem esta conferência o erro apareceria como
// "0 objetos, 0 referenciados", que é indistinguível de bucket limpo.
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
  console.error(
    `A chave informada tem papel "${papel}", nao "service_role". Ela nao enxerga as tabelas.
` +
      "Pegue a de servico no painel: Project Settings -> API Keys -> service_role."
  );
  process.exit(1);
}

if (/^\[SENSITIVE\]$/.test(serviceRoleKey)) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY veio como [SENSITIVE]: a Vercel nao devolve variavel sensivel.\n" +
      "Pegue a chave no painel do Supabase, em Project Settings -> API Keys -> service_role."
  );
  process.exit(1);
}

function mb(bytes) {
  return `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Toda coluna do schema que guarda caminho de arquivo. Faltar uma aqui apaga arquivo em uso. */
const COLUNAS_DE_CAMINHO = [
  ["DocumentoGerado", "outputPath"],
  ["DocumentoVersao", "outputPath"],
  ["DocumentoUpload", "uploadPath"],
  ["DocumentoUpload", "outputPath"],
  ["DocumentoUploadVersao", "outputPath"],
  ["Pasta", "formsPdfPath"],
  ["Pasta", "documentosElaboracaoPath"],
  ["Pasta", "clienteLogoPath"],
  ["Template", "arquivoPath"],
  ["TemplateVersao", "arquivoPath"],
];

/**
 * Confere o schema antes de qualquer coisa, pela definição OpenAPI que a própria
 * API REST publica. Se alguém acrescentar uma coluna de caminho e esquecer deste
 * script, um arquivo em uso passaria a parecer órfão — e seria apagado. Aqui
 * isso vira parada, não perda.
 */
async function conferirSchema() {
  const resposta = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!resposta.ok) {
    throw new Error(`Nao consegui ler o schema pela API REST: ${resposta.status} ${resposta.statusText}`);
  }
  const spec = await resposta.json();
  // Swagger 2.0 é o que o PostgREST publica hoje; `components.schemas` cobre o
  // caso de a versão mudar para OpenAPI 3.
  const tabelas = spec.definitions || spec.components?.schemas || {};
  const conhecidas = new Set(COLUNAS_DE_CAMINHO.map(([t, c]) => `${t}.${c}`));
  const encontradas = [];
  const novas = [];

  for (const [tabela, definicao] of Object.entries(tabelas)) {
    for (const coluna of Object.keys(definicao.properties || {})) {
      if (coluna === "nomeArquivo") continue;
      if (!/path|arquivo/i.test(coluna)) continue;
      encontradas.push(`${tabela}.${coluna}`);
      if (!conhecidas.has(`${tabela}.${coluna}`)) novas.push(`${tabela}.${coluna}`);
    }
  }

  // Se a forma da especificação mudar, o laço acima acha zero coluna e o guarda
  // passaria calado — que é o modo de falhar que apaga arquivo em uso. Uma
  // varredura que não reencontra o que já se sabe existir é varredura quebrada.
  const faltando = [...conhecidas].filter((coluna) => !encontradas.includes(coluna));
  if (faltando.length) {
    console.error(
      "PARADO: nao reconheci o schema pela API REST. Estas colunas conhecidas nao apareceram:"
    );
    faltando.forEach((coluna) => console.error(`  ${coluna}`));
    console.error("Sem conferir o schema eu nao sei o que e orfao. Nada foi tocado.");
    process.exit(1);
  }

  if (novas.length) {
    console.error("PARADO: o schema tem coluna de caminho que este script nao conhece:");
    novas.forEach((coluna) => console.error(`  ${coluna}`));
    console.error("Acrescente-a em COLUNAS_DE_CAMINHO antes de rodar de novo.");
    process.exit(1);
  }
}

/** Lê uma coluna inteira, em páginas: a API REST corta em 1000 linhas por vez. */
async function lerColuna(tabela, coluna) {
  const valores = [];
  const passo = 1000;
  for (let inicio = 0; ; inicio += passo) {
    const { data, error } = await supabase
      .from(tabela)
      .select(coluna)
      .not(coluna, "is", null)
      .range(inicio, inicio + passo - 1);
    if (error) throw new Error(`Falha ao ler ${tabela}.${coluna}: ${error.message}`);
    valores.push(...data.map((linha) => linha[coluna]));
    if (data.length < passo) return valores;
  }
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
      // Pasta não tem id nem metadata; é o único jeito de distingui-la de arquivo.
      if (item.id === null) encontrados.push(...(await listarObjetos(nome)));
      else encontrados.push({ name: nome, bytes: BigInt(item.metadata?.size ?? 0), created_at: item.created_at });
    }

    if (data.length < passo) return encontrados;
  }
}

function acumular(mapa, rotulo, bytes) {
  const atual = mapa.get(rotulo) || { objetos: 0, bytes: 0n };
  mapa.set(rotulo, { objetos: atual.objetos + 1, bytes: atual.bytes + bytes });
}

async function main() {
  await conferirSchema();

  const referenciados = new Set();
  for (const [tabela, coluna] of COLUNAS_DE_CAMINHO) {
    for (const valor of await lerColuna(tabela, coluna)) {
      referenciados.add(String(valor).replace(`supabase://${bucket}/`, ""));
    }
  }

  const pastas = new Set((await lerColunaSimples("Pasta", "id")).map(String));
  const objetos = await listarObjetos();

  const grupos = new Map();
  const orfaos = [];
  let totalBytes = 0n;

  for (const objeto of objetos) {
    totalBytes += objeto.bytes;
    const area = objeto.name.split("/")[1] || "(raiz)";

    if (referenciados.has(objeto.name)) {
      acumular(grupos, `${area}: em uso`, objeto.bytes);
      continue;
    }

    // O nome do upload começa pelo id da pasta, então dá para separar o que
    // sobrou de pasta excluída — que além de espaço é retenção de dado — do que
    // sobrou de documento excluído numa pasta viva.
    const prefixo = objeto.name.replace(`storage/${area}/`, "").split("_")[0];
    const rotulo =
      area === "uploads"
        ? pastas.has(prefixo)
          ? "uploads: orfao, pasta ainda existe"
          : "uploads: orfao, pasta ja excluida"
        : `${area}: orfao`;

    const horas = (Date.now() - new Date(objeto.created_at).getTime()) / 3_600_000;
    if (horas < IDADE_MINIMA_HORAS) {
      acumular(grupos, `${rotulo} (recente, preservado)`, objeto.bytes);
      continue;
    }

    acumular(grupos, rotulo, objeto.bytes);
    if (area !== "templates" || INCLUIR_TEMPLATES) orfaos.push(objeto);
  }

  console.log(`\nBucket ${bucket} — ${objetos.length} objetos, ${mb(totalBytes)}\n`);
  for (const [rotulo, dados] of [...grupos.entries()].sort((a, b) => Number(b[1].bytes - a[1].bytes))) {
    console.log(`  ${String(dados.objetos).padStart(5)} objetos  ${mb(dados.bytes).padStart(10)}  ${rotulo}`);
  }

  const bytesOrfaos = orfaos.reduce((soma, o) => soma + o.bytes, 0n);
  const porcento = totalBytes ? ((Number(bytesOrfaos) / Number(totalBytes)) * 100).toFixed(0) : "0";
  console.log(`\n  Orfaos elegiveis: ${orfaos.length} objetos, ${mb(bytesOrfaos)} (${porcento}% do bucket)`);
  if (!INCLUIR_TEMPLATES) console.log("  Orfaos em templates/ ficaram de fora; use --incluir-templates.");
  console.log(`  Orfao com menos de ${IDADE_MINIMA_HORAS}h fica de fora: pode ser envio em andamento.`);

  if (MANIFESTO && orfaos.length) {
    // O manifesto tem nome de arquivo de cliente. Vai para caminho ignorado pelo
    // git, e nunca para commit, handoff ou log (regra 6).
    const destino = path.join(root, `orfaos-${new Date().toISOString().slice(0, 10)}.txt`);
    fs.writeFileSync(destino, orfaos.map((o) => o.name).join("\n") + "\n", "utf8");
    console.log(`\n  Manifesto gravado em ${path.basename(destino)} (ignorado pelo git).`);
  }

  if (!APPLY) {
    console.log("\n  Nada foi removido. Rode de novo com --apply para apagar.\n");
    return;
  }

  let removidos = 0;
  for (let i = 0; i < orfaos.length; i += 100) {
    const lote = orfaos.slice(i, i + 100).map((o) => o.name);
    const { error } = await supabase.storage.from(bucket).remove(lote);
    if (error) throw new Error(`Falha ao remover lote ${Math.floor(i / 100) + 1}: ${error.message}`);
    removidos += lote.length;
    console.log(`  removidos ${removidos}/${orfaos.length}`);
  }
  console.log(`\n  ${removidos} objetos removidos, ${mb(bytesOrfaos)} liberados.\n`);
}

/** Igual a `lerColuna`, mas sem descartar nulo — usada para a lista de ids de Pasta. */
async function lerColunaSimples(tabela, coluna) {
  const valores = [];
  const passo = 1000;
  for (let inicio = 0; ; inicio += passo) {
    const { data, error } = await supabase.from(tabela).select(coluna).range(inicio, inicio + passo - 1);
    if (error) throw new Error(`Falha ao ler ${tabela}.${coluna}: ${error.message}`);
    valores.push(...data.map((linha) => linha[coluna]));
    if (data.length < passo) return valores;
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
