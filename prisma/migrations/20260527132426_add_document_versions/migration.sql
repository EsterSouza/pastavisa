CREATE TABLE "DocumentoVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoId" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "tokensUsados" INTEGER,
    "avisoRtNoCorpo" BOOLEAN NOT NULL DEFAULT false,
    "logoSubstituida" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoVersao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoGerado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DocumentoVersao_documentoId_criadaEm_idx" ON "DocumentoVersao"("documentoId", "criadaEm");
