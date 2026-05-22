-- AlterTable
ALTER TABLE "Pasta" ADD COLUMN "docAno" TEXT;
ALTER TABLE "Pasta" ADD COLUMN "docElaborador" TEXT;
ALTER TABLE "Pasta" ADD COLUMN "docMesExtenso" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentoGerado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pastaId" TEXT NOT NULL,
    "templateId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tokensUsados" INTEGER,
    "mensagemErro" TEXT,
    "avisoRtNoCorpo" BOOLEAN NOT NULL DEFAULT false,
    "logoSubstituida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoGerado_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentoGerado_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DocumentoGerado" ("criadoEm", "id", "mensagemErro", "nomeArquivo", "outputPath", "pastaId", "status", "templateId", "tokensUsados") SELECT "criadoEm", "id", "mensagemErro", "nomeArquivo", "outputPath", "pastaId", "status", "templateId", "tokensUsados" FROM "DocumentoGerado";
DROP TABLE "DocumentoGerado";
ALTER TABLE "new_DocumentoGerado" RENAME TO "DocumentoGerado";
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "padraoHeader" TEXT NOT NULL,
    "processingType" TEXT NOT NULL DEFAULT 'LIGHT_HAIKU',
    "arquivoPath" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Template" ("arquivoPath", "ativo", "criadoEm", "id", "nome", "padraoHeader", "tipo") SELECT "arquivoPath", "ativo", "criadoEm", "id", "nome", "padraoHeader", "tipo" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
