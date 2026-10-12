ALTER TABLE "Pasta" ADD COLUMN "linkDrive" TEXT;
ALTER TABLE "Pasta" ADD COLUMN "linkOneDrive" TEXT;
ALTER TABLE "Pasta" ADD COLUMN "senhaOneDrive" TEXT;

CREATE TABLE "EmailEnviado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pastaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "enviadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailEnviado_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EmailEnviado_pastaId_enviadoEm_idx" ON "EmailEnviado"("pastaId", "enviadoEm");
