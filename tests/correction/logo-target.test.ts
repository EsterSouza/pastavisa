import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import sharp from "sharp";
import { replaceLogoInHeadersAndFooters } from "@/lib/header-footer-replace";

/**
 * Qual imagem a troca de logo escolhe.
 *
 * O comportamento antigo era "a imagem de menor rId de cada parte de cabeçalho ou
 * rodapé presente no zip". Isso errava o alvo de duas formas em documentos reais,
 * editados à mão várias vezes:
 *
 * - imagens declaradas no rels mas que nenhum desenho referencia (sobra de revisão
 *   anterior) entravam na disputa e, por terem rId baixo, geralmente ganhavam;
 * - partes de cabeçalho órfãs — dentro do zip, mas não referenciadas por nenhum
 *   `<w:sectPr>` — eram percorridas, e o arquivo de mídia que elas apontam pode ser
 *   o mesmo de outra parte, então a troca aparecia como imagem errada substituída.
 *
 * Este teste fixa o alvo: só imagens efetivamente desenhadas, só em partes vigentes,
 * com prioridade para a que está dentro de uma célula de tabela — o formato do slot
 * de logo em todo o projeto.
 */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const RELS_ABRE =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
const TIPO_IMAGEM = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

/** Altura vigente do desenho da logo no fixture: 1,9 cm, como nos documentos reais. */
const ALTURA_LOGO_EMU = 684_000;
/** Largura vigente: 2 cm, também como nos documentos reais. */
const LARGURA_LOGO_EMU = 720_000;

function desenho(rId: string, cx = LARGURA_LOGO_EMU, cy = ALTURA_LOGO_EMU): string {
  return (
    "<w:drawing><wp:inline>" +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    "<a:graphic><a:graphicData><pic:pic><pic:blipFill>" +
    `<a:blip r:embed="${rId}"/>` +
    "</pic:blipFill><pic:spPr><a:xfrm>" +
    `<a:ext cx="${cx}" cy="${cy}"/>` +
    "</a:xfrm></pic:spPr></pic:pic></a:graphicData></a:graphic>" +
    "</wp:inline></w:drawing>"
  );
}

/** Extent distinto para a foto, para provar que ela não é redimensionada. */
const FOTO_CX = 900_000;
const FOTO_CY = 600_000;

function celulaComDesenho(
  rId: string,
  larguraTwips: number,
  altura?: { twips: number; hRule: "exact" | "atLeast" | "ausente" }
): string {
  const trPr = altura
    ? `<w:trPr><w:trHeight${altura.hRule === "ausente" ? "" : ` w:hRule="${altura.hRule}"`} w:val="${altura.twips}"/></w:trPr>`
    : "";
  return (
    `<w:tbl><w:tr>${trPr}<w:tc>` +
    `<w:tcPr><w:tcW w:w="${larguraTwips}" w:type="dxa"/></w:tcPr>` +
    `<w:p><w:r>${desenho(rId)}</w:r></w:p>` +
    "</w:tc></w:tr></w:tbl>"
  );
}

function relacaoImagem(rId: string, target: string): string {
  return `<Relationship Id="${rId}" Type="${TIPO_IMAGEM}" Target="${target}"/>`;
}

/** Bytes distintos por arquivo, para saber exatamente qual mídia foi reescrita. */
function midia(marcador: number): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, marcador]);
}

interface Opcoes {
  /** Quando falso, nenhum `<w:sectPr>` referencia cabeçalho — grafo irresolvível. */
  comSectPr?: boolean;
  /** Altura declarada da linha da logo. Ausente = linha sem `<w:trHeight>`. */
  altura?: { twips: number; hRule: "exact" | "atLeast" | "ausente" };
}

/**
 * Cabeçalho vigente (header1) com duas imagens desenhadas — uma foto solta de rId
 * menor e a logo dentro de uma célula — mais uma imagem só declarada no rels. Um
 * segundo cabeçalho (header2) existe no zip mas nenhum `<w:sectPr>` o referencia.
 */
function montarDocxComLogo({ comSectPr = true, altura }: Opcoes = {}): PizZip {
  const zip = new PizZip();

  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    RELS_ABRE +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>"
  );

  const sectPr = comSectPr
    ? '<w:sectPr><w:headerReference w:type="default" r:id="rId10"/></w:sectPr>'
    : "";
  zip.file(
    "word/document.xml",
    `<w:document ${W} ${R}><w:body><w:p><w:r><w:t>corpo</w:t></w:r></w:p>${sectPr}</w:body></w:document>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    RELS_ABRE +
      '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId20" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' +
      "</Relationships>"
  );

  zip.file(
    "word/header1.xml",
    `<w:hdr ${W} ${R}><w:p><w:r>${desenho("rId5", FOTO_CX, FOTO_CY)}</w:r></w:p>` +
      `${celulaComDesenho("rId7", 4000, altura)}</w:hdr>`
  );
  zip.file(
    "word/_rels/header1.xml.rels",
    RELS_ABRE +
      relacaoImagem("rId3", "media/orfa.png") +
      relacaoImagem("rId5", "media/foto.png") +
      relacaoImagem("rId7", "media/logo.png") +
      "</Relationships>"
  );

  zip.file("word/header2.xml", `<w:hdr ${W} ${R}>${celulaComDesenho("rId9", 4000)}</w:hdr>`);
  zip.file(
    "word/_rels/header2.xml.rels",
    RELS_ABRE + relacaoImagem("rId9", "media/antiga.png") + "</Relationships>"
  );

  zip.file("word/media/orfa.png", midia(1), { binary: true });
  zip.file("word/media/foto.png", midia(2), { binary: true });
  zip.file("word/media/logo.png", midia(3), { binary: true });
  zip.file("word/media/antiga.png", midia(4), { binary: true });

  return zip;
}

function bytes(zip: PizZip, caminho: string): Buffer {
  return Buffer.from(zip.files[caminho].asUint8Array());
}

async function logoNova(): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

describe("alvo da troca de logo", () => {
  it("troca a imagem da célula, e não a de menor rId nem a que só existe no rels", async () => {
    const zip = montarDocxComLogo();
    const antes = {
      orfa: bytes(zip, "word/media/orfa.png"),
      foto: bytes(zip, "word/media/foto.png"),
      logo: bytes(zip, "word/media/logo.png"),
    };

    const { substituida } = await replaceLogoInHeadersAndFooters(zip, await logoNova());

    expect(substituida).toBe(true);
    expect(bytes(zip, "word/media/logo.png")).not.toEqual(antes.logo);
    // rId5 é desenhado, mas fora de célula: perde para a logo da célula.
    expect(bytes(zip, "word/media/foto.png")).toEqual(antes.foto);
    // rId3 é o menor de todos e não é desenhado por ninguém: fora da disputa.
    expect(bytes(zip, "word/media/orfa.png")).toEqual(antes.orfa);
  });

  it("não toca parte de cabeçalho que o corpo não referencia", async () => {
    const zip = montarDocxComLogo();
    const antes = bytes(zip, "word/media/antiga.png");

    await replaceLogoInHeadersAndFooters(zip, await logoNova());

    expect(bytes(zip, "word/media/antiga.png")).toEqual(antes);
  });

  it("cai para as partes existentes quando o grafo de referências não resolve", async () => {
    const zip = montarDocxComLogo({ comSectPr: false });
    const antes = {
      logo: bytes(zip, "word/media/logo.png"),
      antiga: bytes(zip, "word/media/antiga.png"),
    };

    const { substituida } = await replaceLogoInHeadersAndFooters(zip, await logoNova());

    // Sem sectPr não há como saber qual parte vige, então o comportamento anterior
    // é preservado: percorre as partes presentes em vez de não fazer nada.
    expect(substituida).toBe(true);
    expect(bytes(zip, "word/media/logo.png")).not.toEqual(antes.logo);
    expect(bytes(zip, "word/media/antiga.png")).not.toEqual(antes.antiga);
  });

  it("redimensiona só o desenho da logo, deixando as outras imagens no tamanho", async () => {
    const zip = montarDocxComLogo();

    await replaceLogoInHeadersAndFooters(zip, await logoNova());

    const { cx, cy } = await medidasDaLogo(zip);
    const daFoto = (zip.files["word/header1.xml"].asText().match(/<w:drawing[\s\S]*?<\/w:drawing>/g) ?? [])
      .find((bloco) => bloco.includes('r:embed="rId5"'));

    // Logo 300x100 (3:1) numa altura vigente de 684.000 EMU: a largura resultante
    // (2.052.000) cabe na largura útil da célula, então a altura é que amarra.
    expect(cy).toBe(ALTURA_LOGO_EMU);
    expect(cx).toBe(ALTURA_LOGO_EMU * 3);
    // A foto ao lado não é a logo: mexer no extent dela a esticaria para a caixa
    // da logo, entregando um cabeçalho com imagem distorcida.
    expect(daFoto).toContain(`cx="${FOTO_CX}"`);
    expect(daFoto).toContain(`cy="${FOTO_CY}"`);
  });

  /** Medidas finais do desenho da logo, em EMU. */
  async function medidasDaLogo(zip: PizZip): Promise<{ cx: number; cy: number }> {
    const daLogo = (zip.files["word/header1.xml"].asText().match(/<w:drawing[\s\S]*?<\/w:drawing>/g) ?? [])
      .find((bloco) => bloco.includes('r:embed="rId7"'));
    return {
      cx: Number(daLogo?.match(/wp:extent[^>]*?\scx="(\d+)"/)?.[1]),
      cy: Number(daLogo?.match(/wp:extent[^>]*?\scy="(\d+)"/)?.[1]),
    };
  }

  async function aplicarEMedir(zip: PizZip, logo?: Buffer) {
    await replaceLogoInHeadersAndFooters(zip, logo ?? (await logoNova()));
    return medidasDaLogo(zip);
  }

  // Célula de 4000 twips: largura útil = 2.336.800 EMU.
  const LARGURA_UTIL_EMU = Math.round(4000 * 635 * 0.92);

  it("nunca cresce a altura que o desenho já ocupava", async () => {
    // A invariante que a Ester nomeou depois de ver o cabeçalho crescer: a faixa do
    // cabeçalho está dimensionada para a logo que está ali, então a nova não pode
    // passar dessa altura em nenhum formato.
    const formatos: Array<[string, number, number]> = [
      ["quadrada", 500, 500],
      ["larga 3:1", 900, 300],
      ["faixa 6:1", 1800, 300],
      ["alta 1:2", 400, 800],
    ];

    for (const [, largura, alturaPx] of formatos) {
      const logo = await sharp({
        create: { width: largura, height: alturaPx, channels: 3, background: { r: 1, g: 2, b: 3 } },
      })
        .png()
        .toBuffer();
      const { cx, cy } = await aplicarEMedir(montarDocxComLogo(), logo);

      expect(cy).toBeLessThanOrEqual(ALTURA_LOGO_EMU);
      expect(cx).toBeLessThanOrEqual(LARGURA_UTIL_EMU);
    }
  });

  it("aproveita toda a altura disponível quando a largura permite", async () => {
    // "Justinha na altura": logo alta é limitada pela altura vigente e a usa inteira.
    const alta = await sharp({
      create: { width: 400, height: 800, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    const { cx, cy } = await aplicarEMedir(montarDocxComLogo(), alta);

    expect(cy).toBe(ALTURA_LOGO_EMU);
    expect(cx).toBe(Math.round(ALTURA_LOGO_EMU / 2));
  });

  it("usa o teto da linha quando ele é mais apertado que a altura vigente", async () => {
    // `hRule="exact"` corta o que passar da linha, então vale o mais apertado dos dois.
    const tetoLinhaEmu = 800 * 635;
    const { cx, cy } = await aplicarEMedir(
      montarDocxComLogo({ altura: { twips: 800, hRule: "exact" } })
    );

    expect(tetoLinhaEmu).toBeLessThan(ALTURA_LOGO_EMU);
    expect(cy).toBe(tetoLinhaEmu);
    expect(cx).toBe(tetoLinhaEmu * 3);
  });

  it("ignora `atLeast`, que é altura mínima e não máxima", async () => {
    // Caso dos documentos reais: `<w:trHeight w:val="419"/>` sem `hRule`, o que
    // significa `atLeast` por padrão — 0,74 cm de mínimo, com a linha crescendo
    // conforme o conteúdo. Tratar isso como teto encolheria a logo a um terço.
    const semRegra = await aplicarEMedir(
      montarDocxComLogo({ altura: { twips: 419, hRule: "ausente" } })
    );
    const explicito = await aplicarEMedir(
      montarDocxComLogo({ altura: { twips: 419, hRule: "atLeast" } })
    );
    const semAltura = await aplicarEMedir(montarDocxComLogo());

    expect(semRegra).toEqual(semAltura);
    expect(explicito).toEqual(semAltura);
    expect(semRegra.cy).toBeGreaterThan(419 * 635);
  });

  it("nunca passa da largura da célula, que alargaria a tabela do cabeçalho", async () => {
    // Logo em faixa muito larga: a altura vigente permitiria muito mais largura do
    // que a célula tem, e é a largura que precisa amarrar.
    const faixa = await sharp({
      create: { width: 2000, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    const { cx } = await aplicarEMedir(montarDocxComLogo(), faixa);

    expect(cx).toBe(LARGURA_UTIL_EMU);
    expect(cx).toBeLessThanOrEqual(4000 * 635);
  });

  it("não relata substituição quando nenhuma imagem da parte vigente é desenhada", async () => {
    const zip = montarDocxComLogo();
    // Cabeçalho vigente sem nenhum desenho: as três imagens continuam declaradas.
    zip.file("word/header1.xml", `<w:hdr ${W} ${R}><w:p><w:r><w:t>sem imagem</w:t></w:r></w:p></w:hdr>`);
    const antes = bytes(zip, "word/media/logo.png");

    const { substituida } = await replaceLogoInHeadersAndFooters(zip, await logoNova());

    expect(substituida).toBe(false);
    expect(bytes(zip, "word/media/logo.png")).toEqual(antes);
  });
});
