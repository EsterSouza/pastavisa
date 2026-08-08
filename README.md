# PASTAVISA

Aplicação interna para organizar dados de clientes, associar documentos e referências, gerar pastas
sanitárias em DOCX e manter versões dos arquivos produzidos.

## Continuidade do projeto

O estado verificado, as decisões técnicas, os cards executáveis, os testes e o registro de entregas
ficam no handoff único:

- [`docs/HANDOFF.md`](docs/HANDOFF.md)

Antes de alterar o projeto, leia as seções **Estado verificado**, **Contexto técnico** e o card que
será executado. Trabalhe em apenas um card por task.

## Desenvolvimento local

```powershell
npm.cmd ci
npm.cmd run dev
```

Validação mínima antes de publicar:

```powershell
npm.cmd run build
npm.cmd run check:deploy
```

Use `.env.example` apenas como catálogo de nomes. Nunca registre valores, chaves ou credenciais.
