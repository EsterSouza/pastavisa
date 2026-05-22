import PizZip from "pizzip";
import path from "path";

export interface DocxValidationIssue {
  file: string;
  message: string;
}

export interface DocxValidationResult {
  valid: boolean;
  issues: DocxValidationIssue[];
}

function isNameChar(ch: string): boolean {
  return /[A-Za-z0-9_:\-.]/.test(ch);
}

function parseTagName(tag: string): string {
  let i = 0;
  while (i < tag.length && /\s/.test(tag[i])) i++;
  if (tag[i] === "/") i++;

  const start = i;
  while (i < tag.length && isNameChar(tag[i])) i++;
  return tag.slice(start, i);
}

function lineAndColumn(xml: string, index: number): string {
  const before = xml.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);
  return `linha ${lines.length}, coluna ${lines[lines.length - 1].length + 1}`;
}

function validateXmlWellFormed(xml: string): string | null {
  const stack: Array<{ name: string; index: number }> = [];
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

function hasContentTypeForPart(contentTypesXml: string, partName: string): boolean {
  const ext = path.posix.extname(partName).slice(1).toLowerCase();
  if (!ext) return true;

  return (
    contentTypesXml.includes(`Extension="${ext}"`) ||
    contentTypesXml.includes(`PartName="/${partName}"`)
  );
}

function relsOwnerDir(relsPath: string): string {
  if (relsPath === "_rels/.rels") return "";

  const match = /^(.*)\/_rels\/([^/]+)\.rels$/.exec(relsPath);
  if (!match) return "";

  return match[1];
}

function resolveRelationshipTarget(relsPath: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return null;

  const cleanTarget = target.split("#")[0];
  const ownerDir = relsOwnerDir(relsPath);
  return path.posix.normalize(path.posix.join(ownerDir, cleanTarget));
}

function validateDocxPackage(zip: PizZip): DocxValidationIssue[] {
  const issues: DocxValidationIssue[] = [];
  const contentTypesXml = zip.files["[Content_Types].xml"]?.asText();

  if (!contentTypesXml) {
    issues.push({ file: "[Content_Types].xml", message: "Arquivo de content types ausente" });
    return issues;
  }

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith("word/media/")) continue;
    if (!hasContentTypeForPart(contentTypesXml, name)) {
      issues.push({
        file: "[Content_Types].xml",
        message: `Content type ausente para ${name}`,
      });
    }
  }

  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith(".rels")) continue;

    let relsXml = "";
    try {
      relsXml = zip.files[name].asText();
    } catch {
      continue;
    }

    const relationshipMatches = Array.from(
      relsXml.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*>/g)
    );
    for (const match of relationshipMatches) {
      const targetMode = /TargetMode="External"/.test(match[0]);
      if (targetMode) continue;

      const resolved = resolveRelationshipTarget(name, match[1]);
      if (!resolved) continue;
      if (!zip.files[resolved]) {
        issues.push({
          file: name,
          message: `Relacionamento aponta para parte ausente: ${match[1]} -> ${resolved}`,
        });
      }
    }
  }

  return issues;
}

export function validateDocxBuffer(buffer: Buffer): DocxValidationResult {
  const issues: DocxValidationIssue[] = [];
  let zip: PizZip;

  try {
    zip = new PizZip(buffer);
  } catch (err) {
    return {
      valid: false,
      issues: [{ file: "(docx)", message: err instanceof Error ? err.message : "ZIP invalido" }],
    };
  }

  for (const name of Object.keys(zip.files)) {
    if (!/\.(xml|rels)$/i.test(name)) continue;

    try {
      const xml = zip.files[name].asText();
      const error = validateXmlWellFormed(xml);
      if (error) issues.push({ file: name, message: error });
    } catch (err) {
      issues.push({
        file: name,
        message: err instanceof Error ? err.message : "Nao foi possivel ler XML",
      });
    }
  }

  issues.push(...validateDocxPackage(zip));

  return { valid: issues.length === 0, issues };
}

export function assertValidDocxBuffer(buffer: Buffer): void {
  const result = validateDocxBuffer(buffer);
  if (result.valid) return;

  const first = result.issues[0];
  const details = result.issues
    .slice(0, 3)
    .map((issue) => `${issue.file}: ${issue.message}`)
    .join(" | ");

  throw new Error(
    `DOCX gerado invalido antes de salvar (${first.file}). ${details}`
  );
}
