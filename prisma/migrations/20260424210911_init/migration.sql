-- CreateTable
CREATE TABLE "Pasta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "clienteRtNome" TEXT,
    "clienteRtProfissao" TEXT,
    "clienteRtConselho" TEXT,
    "clienteLogoPath" TEXT,
    "clienteEstrutura" TEXT,
    "clienteServicos" TEXT,
    "clienteEquipamentos" TEXT,
    "clienteTerceirizados" TEXT,
    "clienteColetaRazao" TEXT,
    "clienteColetaCnpj" TEXT,
    "clienteResiduosA" TEXT,
    "clienteResiduosD" TEXT,
    "clienteResiduosE" TEXT,
    "clienteInfoAdicionais" TEXT,
    "formsPdfPath" TEXT,
    "documentosElaboracaoPath" TEXT
);

-- CreateTable
CREATE TABLE "DocumentoGerado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pastaId" TEXT NOT NULL,
    "templateId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tokensUsados" INTEGER,
    "mensagemErro" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentoGerado_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "Pasta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentoGerado_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "padraoHeader" TEXT NOT NULL,
    "arquivoPath" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Legislacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estadoUf" TEXT NOT NULL,
    "municipio" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "referenciaAbnt" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);
