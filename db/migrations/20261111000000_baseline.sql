-- Esquema-base do banco `pastavisa` no Postgres da Treinavisa (caixa `data`).
-- Gerado em 11/11/2026 por `prisma migrate diff --from-empty --to-schema
-- prisma/schema.postgres.prisma --script` e conferido contra o projeto Supabase
-- de origem (mesmos índices e chaves estrangeiras).
--
-- Mudança de modelo daqui em diante: editar `prisma/schema.postgres.prisma`
-- (e o `schema.prisma` do SQLite local), gerar o SQL com `prisma migrate diff`
-- e gravar um arquivo novo nesta pasta. Quem aplica no banco é a infra.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Pasta" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),
    "clienteNomeFantasia" TEXT,
    "clienteRazaoSocial" TEXT,
    "clienteCnpj" TEXT,
    "clienteEndereco" TEXT,
    "clienteCidade" TEXT,
    "clienteEstado" TEXT,
    "clienteEstadoExtenso" TEXT,
    "clienteTelefone" TEXT,
    "clienteEmail" TEXT,
    "clienteHorario" TEXT,
    "clienteProprietarioNome" TEXT,
    "clienteRtNome" TEXT,
    "clienteRtProfissao" TEXT,
    "clienteRtConselho" TEXT,
    "clienteResponsaveisTecnicos" TEXT,
    "clienteLogoPath" TEXT,
    "clienteLogoBgHex" TEXT,
    "clienteEstrutura" TEXT,
    "clienteMemorialDescritivoMbp" TEXT,
    "clienteServicos" TEXT,
    "clienteFuncionarios" TEXT,
    "clienteEquipamentos" TEXT,
    "clienteProdutosInsumos" TEXT,
    "clienteTerceirizados" TEXT,
    "clienteColetaRazao" TEXT,
    "clienteColetaCnpj" TEXT,
    "clienteResiduosA" TEXT,
    "clienteResiduosD" TEXT,
    "clienteResiduosE" TEXT,
    "clienteInfoAdicionais" TEXT,
    "docElaborador" TEXT,
    "docMesExtenso" TEXT,
    "docAno" TEXT,
    "formsPdfPath" TEXT,
    "documentosElaboracaoPath" TEXT,
    "legislacaoIds" TEXT,
    "inicioProjeto" TIMESTAMP(3),
    "apreciacaoInicio" TIMESTAMP(3),
    "apreciacaoFim" TIMESTAMP(3),
    "entregaFinal" TIMESTAMP(3),
    "versaoPasta" TEXT,
    "prazosLidosEm" TIMESTAMP(3),
    "linkDrive" TEXT,
    "linkOneDrive" TEXT,
    "senhaOneDrive" TEXT,

    CONSTRAINT "Pasta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEnviado" (
    "id" TEXT NOT NULL,
    "pastaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoGerado" (
    "id" TEXT NOT NULL,
    "pastaId" TEXT NOT NULL,
    "templateId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tokensUsados" INTEGER,
    "mensagemErro" TEXT,
    "avisoRtNoCorpo" BOOLEAN NOT NULL DEFAULT false,
    "logoSubstituida" BOOLEAN NOT NULL DEFAULT false,
    "equipamentosSelecionados" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoGerado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoVersao" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "tokensUsados" INTEGER,
    "avisoRtNoCorpo" BOOLEAN NOT NULL DEFAULT false,
    "logoSubstituida" BOOLEAN NOT NULL DEFAULT false,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoUpload" (
    "id" TEXT NOT NULL,
    "pastaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "uploadPath" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "mensagemErro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoUploadVersao" (
    "id" TEXT NOT NULL,
    "documentoUploadId" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "substituicoes" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoUploadVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "padraoHeader" TEXT NOT NULL,
    "processingType" TEXT NOT NULL DEFAULT 'LIGHT_HAIKU',
    "arquivoPath" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersao" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "padraoHeader" TEXT NOT NULL,
    "processingType" TEXT NOT NULL,
    "arquivoPath" TEXT NOT NULL,
    "motivo" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Legislacao" (
    "id" TEXT NOT NULL,
    "estadoUf" TEXT NOT NULL,
    "municipio" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "referenciaAbnt" TEXT NOT NULL,
    "destaqueAbnt" TEXT,
    "chaveReferencia" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Legislacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContagemPaginas" (
    "id" TEXT NOT NULL,
    "pastaId" TEXT,
    "cliente" TEXT NOT NULL,
    "versao" TEXT,
    "paginas" INTEGER NOT NULL,
    "documentos" TEXT NOT NULL,
    "contadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContagemPaginas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEnviado_pastaId_enviadoEm_idx" ON "EmailEnviado"("pastaId", "enviadoEm");

-- CreateIndex
CREATE INDEX "DocumentoVersao_documentoId_criadaEm_idx" ON "DocumentoVersao"("documentoId", "criadaEm");

-- CreateIndex
CREATE INDEX "DocumentoUploadVersao_documentoUploadId_criadaEm_idx" ON "DocumentoUploadVersao"("documentoUploadId", "criadaEm");

-- CreateIndex
CREATE INDEX "TemplateVersao_templateId_criadaEm_idx" ON "TemplateVersao"("templateId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Legislacao_chaveReferencia_key" ON "Legislacao"("chaveReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "ContagemPaginas_pastaId_key" ON "ContagemPaginas"("pastaId");

-- CreateIndex
CREATE INDEX "ContagemPaginas_contadaEm_idx" ON "ContagemPaginas"("contadaEm");

-- AddForeignKey
ALTER TABLE "EmailEnviado" ADD CONSTRAINT "EmailEnviado_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoGerado" ADD CONSTRAINT "DocumentoGerado_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoGerado" ADD CONSTRAINT "DocumentoGerado_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVersao" ADD CONSTRAINT "DocumentoVersao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoGerado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoUpload" ADD CONSTRAINT "DocumentoUpload_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoUploadVersao" ADD CONSTRAINT "DocumentoUploadVersao_documentoUploadId_fkey" FOREIGN KEY ("documentoUploadId") REFERENCES "DocumentoUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersao" ADD CONSTRAINT "TemplateVersao_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

