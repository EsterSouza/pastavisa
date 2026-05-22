const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const files = [
  path.join("storage", "templates", "bulk_1777493572023_TEMPLATE_PSP.docx"),
  path.join("TODOS_OS_TEMPLATES_PastaVISA", "TEMPLATE_PSP.docx"),
];

function compileDocx(buffer, file) {
  try {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    doc.render({});
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || String(error),
      details: error?.properties,
    };
  }
}

function insertMissingDocAnoOpenBrace(xml) {
  const docMesIndex = xml.indexOf("doc_mes_extenso");
  if (docMesIndex < 0) return { xml, changed: false, reason: "doc_mes_extenso not found" };

  const docRunIndex = xml.indexOf("<w:t>doc</w:t>", docMesIndex);
  if (docRunIndex < 0) return { xml, changed: false, reason: "split doc_ano run not found" };

  const scanStart = Math.max(0, docRunIndex - 1200);
  const alreadyHasOpenBrace = xml.lastIndexOf("<w:t>{</w:t>", docRunIndex) > scanStart;
  if (alreadyHasOpenBrace) return { xml, changed: false, reason: "open brace already present" };

  const proofStart = xml.lastIndexOf('<w:proofErr w:type="spellStart"/>', docRunIndex);
  if (proofStart < scanStart) return { xml, changed: false, reason: "proofErr before doc_ano not found" };

  const openBraceRun = '<w:r><w:t>{</w:t></w:r>';
  return {
    xml: xml.slice(0, proofStart) + openBraceRun + xml.slice(proofStart),
    changed: true,
  };
}

let changedCount = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP missing ${file}`);
    continue;
  }

  const original = fs.readFileSync(file);
  const before = compileDocx(original, file);
  const zip = new PizZip(original);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    console.log(`FAIL ${file}: word/document.xml not found`);
    continue;
  }

  const result = insertMissingDocAnoOpenBrace(documentFile.asText());
  if (!result.changed) {
    console.log(`OK ${file}: no change (${result.reason})`);
    continue;
  }

  zip.file("word/document.xml", result.xml);
  const output = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  const after = compileDocx(output, file);

  if (!after.ok) {
    console.log(`FAIL ${file}: repaired file still does not compile`);
    console.log(JSON.stringify(after.details || after.message, null, 2));
    continue;
  }

  const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, output);
  changedCount += 1;
  console.log(`FIXED ${file}`);
  console.log(`  backup: ${backup}`);
  if (!before.ok) console.log(`  previous error: ${before.message}`);
}

console.log(`Done. Fixed ${changedCount} file(s).`);
