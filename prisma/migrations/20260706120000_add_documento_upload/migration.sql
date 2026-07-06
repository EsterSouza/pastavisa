CREATE TABLE "DocumentoUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pastaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "uploadPath" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "mensagemErro" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoUpload_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DocumentoUploadVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoUploadId" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "substituicoes" TEXT,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoUploadVersao_documentoUploadId_fkey" FOREIGN KEY ("documentoUploadId") REFERENCES "DocumentoUpload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DocumentoUploadVersao_documentoUploadId_criadaEm_idx" ON "DocumentoUploadVersao"("documentoUploadId", "criadaEm");
