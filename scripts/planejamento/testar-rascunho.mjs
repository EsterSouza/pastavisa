// Roda o rascunho do planejamento direto, sem tela nem login, com os arquivos de uma pasta.
// Uso: [CATALOGO=templates.json] node --env-file=.env scripts/planejamento/testar-rascunho.mjs "<pasta da cliente>"
import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";

const raiz = path.resolve(import.meta.dirname, "..", "..");
const jiti = createJiti(import.meta.filename, { alias: { "@": raiz }, interopDefault: true });

const pasta = process.argv[2];
if (!pasta) throw new Error("Informe a pasta da cliente.");

const { blocosDosAnexos } = jiti(path.join(raiz, "lib/planejamento/anexos.ts"));
const { lerFormulario, escolherReferencias } = jiti(path.join(raiz, "lib/planejamento/ia.ts"));
const { montarPlanejamento } = jiti(path.join(raiz, "lib/planejamento/montar.ts"));
const { candidatasDoBanco } = jiti(path.join(raiz, "lib/planejamento/referencias.ts"));
const { normalizeStateName, toUF, UF_OPTIONS } = jiti("@visa/legislacao");
const { prisma } = jiti(path.join(raiz, "lib/prisma.ts"));

const anexos = fs
  .readdirSync(pasta)
  .filter((nome) => /\.(pdf|jpe?g|png|docx|txt)$/i.test(nome) && !/^logo/i.test(nome))
  .map((nome) => ({ nome, conteudo: fs.readFileSync(path.join(pasta, nome)) }));
console.log(`${anexos.length} arquivos`);

const inicio = Date.now();
const { blocos, ignorados } = await blocosDosAnexos(anexos);
// CATALOGO=<arquivo.json> usa o catálogo de produção ([{nome, tipo}]); o SQLite local pode estar vazio.
const doBanco = process.env.CATALOGO
  ? JSON.parse(fs.readFileSync(process.env.CATALOGO, "utf8"))
  : await prisma.template.findMany({ where: { ativo: true }, select: { nome: true, tipo: true }, orderBy: { nome: "asc" } });
const templates = doBanco.map((t, i) => ({ id: `T${String(i + 1).padStart(3, "0")}`, nome: t.nome, tipo: t.tipo }));

const { rascunho, tokens } = await lerFormulario({ anexos: blocos, templates });
const resultado = montarPlanejamento(
  rascunho,
  { dataPlanejamento: new Date().toISOString().slice(0, 10), versaoPasta: "Digital", plataforma: "Google Drive", corLogo: "" },
  templates
);
console.log(`OK em ${Math.round((Date.now() - inicio) / 1000)} s, ${tokens} tokens, ignorados: ${ignorados.join(", ") || "nenhum"}`);
// Segunda etapa, como a tela faz depois do rascunho (perfil igual ao de PlanejamentoEditor).
const plano = resultado.planejamento;
const campo = (rotulo) => plano.identificacao.find((c) => rotulo.test(c.rotulo))?.valor || "";
const perfil = [
  `Nome: ${plano.nomeCliente}`,
  `Cidade/UF: ${plano.cidadeUf}`,
  `Atividade: ${campo(/atividade/i)}`,
  `Profissões da equipe: ${resultado.profissoes.join(", ")}`,
  `Responsável técnica: ${campo(/respons[aá]vel/i)}`,
  `Procedimentos: ${plano.procedimentos.join("; ")}`,
  `Equipamentos: ${plano.equipamentos.map((e) => e.nome).join("; ")}`,
  `Terceirizados e esterilização: ${plano.terceirizados.map((t) => `${t.rotulo}: ${t.valor || "não informado"}`).join("; ")}`,
  `Estrutura física: ${plano.estruturaFisica.join(" ")}`,
  `Documentos planejados: ${plano.secoes.flatMap((s) => s.itens).join("; ")}`,
].join("
");
const uf = toUF(rascunho.uf);
const estado = UF_OPTIONS.find((o) => o.uf === uf)?.name || normalizeStateName(uf);
const { lista } = candidatasDoBanco(uf, rascunho.cidade);
const t2 = Date.now();
const { escolha } = await escolherReferencias({ perfil, estado, municipio: rascunho.cidade, candidatas: lista });
console.log(`Referências OK em ${Math.round((Date.now() - t2) / 1000)} s: ${escolha.grupos.map((g) => `${g.titulo} (${g.ids.length})`).join("; ")}`);

const saida = process.argv[3] || path.join(raiz, "rascunho-teste.json");
fs.writeFileSync(saida, JSON.stringify({ rascunho, resultado, escolha }, null, 2));
console.log(`Resultado em ${saida}`);
await prisma.$disconnect();
