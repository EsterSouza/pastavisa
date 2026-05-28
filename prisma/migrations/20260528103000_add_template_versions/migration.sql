CREATE TABLE "TemplateVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "padraoHeader" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "arquivoPath" TEXT NOT NULL,
    "motivo" TEXT,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemplateVersao_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TemplateVersao_templateId_criadaEm_idx" ON "TemplateVersao"("templateId", "criadaEm");
