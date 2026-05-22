# PastaVISA — Como usar

## Primeiro uso

1. Abra o arquivo `.env` e substitua `sua-chave-aqui` pela sua chave da Anthropic API:
   ```
   ANTHROPIC_API_KEY="sk-ant-..."
   ```

2. Abra o terminal na pasta `pastavirus` e rode:
   ```
   npm run dev
   ```

3. Acesse http://localhost:3000

## Fluxo de trabalho

### 1. Cadastrar templates
- Vá em **Templates** → **Adicionar template**
- Faça upload de um `.docx` de cliente anterior
- Selecione o tipo (MBP, POP, TCLE, etc.) e o padrão de cabeçalho
- Para marcar trechos para adaptação por IA, insira o texto `[AI_ADAPT_START]` antes do trecho e `[AI_ADAPT_END]` depois

### 2. Cadastrar legislações (opcional)
- Vá em **Legislações** → preencha as legislações estaduais/municipais que você usa com frequência

### 3. Criar nova pasta
- Clique em **Nova Pasta**
- Faça upload do **PDF do forms.app** e do **Documentos em Elaboração (.docx)**
- Clique em **Extrair dados com IA** — o sistema usa o Claude para preencher automaticamente os campos

### 4. Revisar e editar dados
- Verifique todos os campos extraídos
- Edite o que for necessário
- Faça upload da **logo do cliente** (.png ou .jpg)
- Clique em **Salvar e ir para processamento**

### 5. Gerar documentos
- Para cada documento listado, selecione o template base no dropdown
- Selecione as legislações a incluir (filtradas pelo estado do cliente)
- Clique em **Gerar todos os documentos**
- Acompanhe o progresso em tempo real
- Clique em **Download ZIP** ao terminar

## Variáveis nos templates

Use `{nome_da_variavel}` (chaves simples) nos templates .docx. Variáveis disponíveis:

| Variável | Descrição |
|---|---|
| `{cliente_nome_fantasia}` | Nome fantasia |
| `{cliente_razao_social}` | Razão social |
| `{cliente_cnpj}` | CNPJ |
| `{cliente_endereco}` | Endereço completo |
| `{cliente_cidade}` | Cidade |
| `{cliente_estado}` | UF (ex: AM) |
| `{cliente_estado_extenso}` | Estado por extenso |
| `{cliente_rt_nome}` | Nome do RT |
| `{cliente_rt_profissao}` | Profissão do RT |
| `{cliente_rt_conselho}` | Conselho do RT |
| `{doc_emissao}` | MM/AAAA da emissão |
| `{doc_revisao_1ano}` | Revisão em 1 ano |
| `{doc_revisao_2anos}` | Revisão em 2 anos |
| `{doc_versao}` | Versão do documento |
| `{doc_elaborador}` | Nome abreviado do cliente |
| `{cliente_estrutura_fisica}` | Estrutura física |
| `{cliente_servicos_lista}` | Lista de serviços |
| `{cliente_equipamentos_lista}` | Lista de equipamentos |
| `{cliente_terceirizados}` | Terceirizados |
| `{cliente_coleta_razao_social}` | Empresa de coleta |
| `{cliente_coleta_cnpj}` | CNPJ da coleta |
| `{cliente_residuos_grupo_a}` | Resíduos Grupo A |
| `{cliente_residuos_grupo_d}` | Resíduos Grupo D |
| `{cliente_residuos_grupo_e}` | Resíduos Grupo E |

## Adaptação por IA

Para que um trecho de texto seja adaptado pela IA (Claude Sonnet), insira no .docx:

```
[AI_ADAPT_START]
... trecho do documento do cliente anterior que deve ser adaptado ...
[AI_ADAPT_END]
```

A IA receberá os dados do novo cliente e retornará o trecho adaptado mantendo a mesma estrutura.
