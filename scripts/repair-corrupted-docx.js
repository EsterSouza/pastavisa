const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "storage", "output");
const BACKUP_ROOT = path.join(
  ROOT,
  "storage",
  "output-backups",
  `repair-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`
);

const IMMEDIATE_REPAIR_TAGS = ["w:pPr", "w:pStyle", "w:proofErr", "w:pgSz", "w:pgMar"];
const EMPTY_REPAIR_TAGS = ["w:pStyle", "w:proofErr", "w:pgSz", "w:pgMar"];
const IMAGE_CONTENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function isNameChar(ch) {
  return /[A-Za-z0-9_:\-.]/.test(ch);
}

function parseTagName(tag) {
  let i = 0;
  while (i < tag.length && /\s/.test(tag[i])) i++;
  if (tag[i] === "/") i++;
  const start = i;
  while (i < tag.length && isNameChar(tag[i])) i++;
  return tag.slice(start, i);
}

function lineAndColumn(xml, index) {
  const before = xml.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);
  return `linha ${lines.length}, coluna ${lines[lines.length - 1].length + 1}`;
}

function validateXmlWellFormed(xml) {
  const stack = [];
  let i = 0;

  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) break;

    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end === -1) return `Comentario XML sem fechamento em ${lineAndColumn(xml, lt)}`;
      i = end + 3;
      continue;
    }

    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      if (end === -1) return `CDATA sem fechamento em ${lineAndColumn(xml, lt)}`;
      i = end + 3;
      continue;
    }

    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end === -1) return `Declaracao XML sem fechamento em ${lineAndColumn(xml, lt)}`;
      i = end + 2;
      continue;
    }

    if (xml.startsWith("<!", lt)) {
      const end = xml.indexOf(">", lt + 2);
      if (end === -1) return `Declaracao XML sem fechamento em ${lineAndColumn(xml, lt)}`;
      i = end + 1;
      continue;
    }

    const gt = xml.indexOf(">", lt + 1);
    if (gt === -1) return `Tag XML sem fechamento em ${lineAndColumn(xml, lt)}`;

    const rawTag = xml.slice(lt + 1, gt);
    const trimmed = rawTag.trim();
    if (!trimmed) return `Tag XML vazia em ${lineAndColumn(xml, lt)}`;

    const closing = trimmed.startsWith("/");
    const selfClosing = /\/\s*$/.test(trimmed);
    const name = parseTagName(trimmed);
    if (!name) return `Tag XML sem nome em ${lineAndColumn(xml, lt)}`;

    if (closing) {
      const top = stack.pop();
      if (!top) return `Fechamento </${name}> sem abertura em ${lineAndColumn(xml, lt)}`;
      if (top.name !== name) {
        return `Tag <${top.name}> aberta em ${lineAndColumn(xml, top.index)} fechou como </${name}> em ${lineAndColumn(xml, lt)}`;
      }
    } else if (!selfClosing) {
      stack.push({ name, index: lt });
    }

    i = gt + 1;
  }

  const top = stack.pop();
  if (top) return `Tag <${top.name}> aberta em ${lineAndColumn(xml, top.index)} nao foi fechada`;
  return null;
}

function validateZipXml(zip) {
  const issues = [];

  for (const name of Object.keys(zip.files)) {
    if (!/\.(xml|rels)$/i.test(name)) continue;
    try {
      const xml = zip.files[name].asText();
      const error = validateXmlWellFormed(xml);
      if (error) issues.push(`${name}: ${error}`);
    } catch (err) {
      issues.push(`${name}: ${err instanceof Error ? err.message : "erro ao ler XML"}`);
    }
  }

  return issues;
}

function hasContentTypeForPart(contentTypesXml, partName) {
  const ext = path.posix.extname(partName).slice(1).toLowerCase();
  if (!ext) return true;
  return (
    contentTypesXml.includes(`Extension="${ext}"`) ||
    contentTypesXml.includes(`PartName="/${partName}"`)
  );
}

function relsOwnerDir(relsPath) {
  if (relsPath === "_rels/.rels") return "";
  const match = /^(.*)\/_rels\/([^/]+)\.rels$/.exec(relsPath);
  return match ? match[1] : "";
}

function resolveRelationshipTarget(relsPath, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return null;
  const cleanTarget = target.split("#")[0];
  return path.posix.normalize(path.posix.join(relsOwnerDir(relsPath), cleanTarget));
}

function validateZipPackage(zip) {
  const issues = [];
  const contentTypes = zip.files["[Content_Types].xml"]?.asText();

  if (!contentTypes) {
    issues.push("[Content_Types].xml: arquivo ausente");
    return issues;
  }

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith("word/media/")) continue;
    if (!hasContentTypeForPart(contentTypes, name)) {
      issues.push(`[Content_Types].xml: content type ausente para ${name}`);
    }
  }

  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith(".rels")) continue;
    let rels = "";
    try {
      rels = zip.files[name].asText();
    } catch {
      continue;
    }

    for (const match of rels.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*>/g)) {
      if (/TargetMode="External"/.test(match[0])) continue;
      const resolved = resolveRelationshipTarget(name, match[1]);
      if (resolved && !zip.files[resolved]) {
        issues.push(`${name}: relacionamento ausente ${match[1]} -> ${resolved}`);
      }
    }
  }

  return issues;
}

function validateZip(zip) {
  return [...validateZipXml(zip), ...validateZipPackage(zip)];
}

function listDocxFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listDocxFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".docx")) {
      results.push(fullPath);
    }
  }
  return results;
}

function ensureImageContentTypes(zip, counters) {
  const contentTypesPath = "[Content_Types].xml";
  let xml = zip.files[contentTypesPath]?.asText();
  if (!xml) return false;

  let changed = false;
  const extensions = new Set();
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith("word/media/")) continue;
    const ext = path.posix.extname(name).slice(1).toLowerCase();
    if (IMAGE_CONTENT_TYPES[ext] && !hasContentTypeForPart(xml, name)) {
      extensions.add(ext);
    }
  }

  for (const ext of extensions) {
    xml = xml.replace(
      "</Types>",
      `<Default Extension="${ext}" ContentType="${IMAGE_CONTENT_TYPES[ext]}"/></Types>`
    );
    counters[`contentType_${ext}`] = (counters[`contentType_${ext}`] || 0) + 1;
    changed = true;
  }

  if (changed) zip.file(contentTypesPath, xml);
  return changed;
}

function repairXml(xml, counters) {
  let repaired = xml;

  for (const tag of IMMEDIATE_REPAIR_TAGS) {
    const escapedTag = tag.replace(":", "\\:");
    const immediateRegex = new RegExp(`<${escapedTag}\\b([^>]*)><\\/w:p>`, "g");
    repaired = repaired.replace(immediateRegex, (match, attrs) => {
      counters[tag] = (counters[tag] || 0) + 1;
      return `<${tag}${attrs}/>`;
    });
  }

  for (const tag of EMPTY_REPAIR_TAGS) {
    const escapedTag = tag.replace(":", "\\:");
    const regex = new RegExp(`<${escapedTag}\\b([^>]*)>`, "g");
    repaired = repaired.replace(regex, (match, attrs) => {
      if (attrs.trim().endsWith("/")) return match;
      counters[tag] = (counters[tag] || 0) + 1;
      return `<${tag}${attrs}/>`;
    });
  }

  repaired = repaired.replace(/<\/w:p>\s*<\/w:pPr>/g, () => {
    counters["w:pPr_orphan_close"] = (counters["w:pPr_orphan_close"] || 0) + 1;
    return "</w:p>";
  });

  return repaired;
}

function backupFile(filePath) {
  const rel = path.relative(OUTPUT_DIR, filePath);
  const target = path.join(BACKUP_ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(filePath, target);
}

function repairDocx(filePath) {
  const original = fs.readFileSync(filePath);
  const zip = new PizZip(original);
  const beforeIssues = validateZip(zip);
  const counters = {};
  let changed = false;

  if (ensureImageContentTypes(zip, counters)) {
    changed = true;
  }

  for (const name of Object.keys(zip.files)) {
    if (!/\.(xml|rels)$/i.test(name)) continue;
    const xml = zip.files[name].asText();
    const repaired = repairXml(xml, counters);
    if (repaired !== xml) {
      changed = true;
      zip.file(name, repaired);
    }
  }

  if (!changed) {
    return beforeIssues.length === 0
      ? { status: "sem erro", counters, issues: [] }
      : { status: "falhou validacao", counters, issues: beforeIssues };
  }

  const afterIssues = validateZip(zip);
  if (afterIssues.length > 0) {
    return { status: "falhou validacao", counters, issues: afterIssues };
  }

  backupFile(filePath);
  const output = zip.generate({ type: "nodebuffer" });
  fs.writeFileSync(filePath, output);
  return { status: "reparado", counters, issues: [] };
}

function main() {
  const files = listDocxFiles(OUTPUT_DIR);
  const totals = { reparado: 0, "sem erro": 0, "falhou validacao": 0 };

  console.log(`Verificando ${files.length} DOCX em ${OUTPUT_DIR}`);

  for (const file of files) {
    try {
      const result = repairDocx(file);
      totals[result.status]++;
      const rel = path.relative(ROOT, file);
      const counts = Object.entries(result.counters)
        .map(([tag, count]) => `${tag}=${count}`)
        .join(", ");
      console.log(`[${result.status}] ${rel}${counts ? ` (${counts})` : ""}`);
      if (result.issues.length > 0) {
        console.log(`  ${result.issues.slice(0, 2).join(" | ")}`);
      }
    } catch (err) {
      totals["falhou validacao"]++;
      console.log(`[falhou validacao] ${path.relative(ROOT, file)}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("");
  console.log("Relatorio:");
  console.log(`  reparado: ${totals.reparado}`);
  console.log(`  sem erro: ${totals["sem erro"]}`);
  console.log(`  falhou validacao: ${totals["falhou validacao"]}`);
  if (totals.reparado > 0) {
    console.log(`  backups: ${BACKUP_ROOT}`);
  }
}

main();
