-- CreateTable
CREATE TABLE "ContagemPaginas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pastaId" TEXT,
    "cliente" TEXT NOT NULL,
    "versao" TEXT,
    "paginas" INTEGER NOT NULL,
    "documentos" TEXT NOT NULL,
    "contadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ContagemPaginas_pastaId_key" ON "ContagemPaginas"("pastaId");

-- CreateIndex
CREATE INDEX "ContagemPaginas_contadaEm_idx" ON "ContagemPaginas"("contadaEm");
