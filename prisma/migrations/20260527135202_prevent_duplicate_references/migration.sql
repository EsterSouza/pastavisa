ALTER TABLE "Legislacao" ADD COLUMN "chaveReferencia" TEXT;

CREATE UNIQUE INDEX "Legislacao_chaveReferencia_key" ON "Legislacao"("chaveReferencia");
