const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const dirs = [
  path.join("storage", "templates"),
  "TODOS_OS_TEMPLATES_PastaVISA",
];

function compile(buffer) {
  try {
    const doc = new Docxtemplater(new PizZip(buffer), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    doc.render({});
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function fixClienteCidade(xml) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const hasBrokenLiteral = paragraph.includes("cliente_cidade}-{cliente_estado}");
    const hasBrokenSplit =
      paragraph.includes("<w:t>cliente_</w:t>") &&
      paragraph.includes("<w:t>cidade</w:t>") &&
      paragraph.includes("<w:t>}-</w:t>") &&
      paragraph.includes("cliente_estado");

    if (!hasBrokenLiteral && !hasBrokenSplit) return paragraph;

    const opening = paragraph.match(/^<w:p\b[^>]*>/)?.[0] || "<w:p>";
    const pPr = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
    return `${opening}${pPr}<w:r><w:t>{cliente_cidade}-{cliente_estado}, _______ de __________________________ de 20_____.</w:t></w:r></w:p>`;
  });
}

function docxFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.docx$/i.test(name))
    .map((name) => path.join(dir, name));
}

let fixed = 0;
let failed = 0;

for (const file of dirs.flatMap(docxFiles)) {
  const input = fs.readFileSync(file);
  const zip = new PizZip(input);
  const document = zip.file("word/document.xml");
  if (!document) continue;

  const xml = document.asText();
  const updated = fixClienteCidade(xml);
  if (updated === xml) continue;

  zip.file("word/document.xml", updated);
  const output = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  const validation = compile(output);

  if (!validation.ok) {
    failed += 1;
    console.log(`FAIL ${file}: ${validation.error.message}`);
    continue;
  }

  const backup = `${file}.bak-tcle-cidade-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, output);
  fixed += 1;
  console.log(`FIXED ${file}`);
}

console.log(`Done. Fixed ${fixed} file(s), failed ${failed}.`);
