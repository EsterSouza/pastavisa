# Tutorial do planner para o time comercial

Gera `docs/tutorial-planner-comercial.pdf` com as telas reais do `/planner` em
produção e as marcações desenhadas por cima. As coordenadas de cada campo vêm do
próprio navegador, então a seta cai no lugar certo mesmo quando a tela muda de
altura — refazer as capturas é o bastante para o tutorial acompanhar a interface.

Rodar na ordem, do diretório do projeto:

```
node scripts/tutorial-comercial/capturar-telas.mjs https://pastavisa.vercel.app <pasta>
node scripts/tutorial-comercial/capturar-cartoes.mjs https://pastavisa.vercel.app <pasta>
node scripts/tutorial-comercial/montar-pdf.mjs <pasta> docs/tutorial-planner-comercial.pdf
```

Cada script de captura faz **uma análise real** em produção, que é chamada paga e
conta no limite do firewall (10 requisições por IP a cada 5 minutos). Rode com
calma e não em série.

Para conferir o resultado sem abrir o PDF à mão:

```
node scripts/tutorial-comercial/rasterizar-para-conferencia.mjs docs/tutorial-planner-comercial.pdf <pasta>
```

O montador aborta quando uma tela não cabe na página, em vez de deixar a imagem
passar por cima do rodapé.

## As duas cores, e por que elas não podem se misturar

O painel é azul e a identidade da marca é azul. Marcação azul sobre interface azul
não é achada, é procurada — e ainda por cima competia com a numeração de tópico do
próprio documento, que também era azul: o mesmo círculo numerado servia para "passo
2 do texto" e para "campo 2 da tela".

Por isso o guia usa duas cores com papéis fechados:

| Papel | Cor | Onde aparece |
| --- | --- | --- |
| Estrutura do documento | azul da marca (`ACAO`) | faixa de etapa, numeração de tópico, avisos informativos, o link |
| Marcação sobre a tela | vermelho (`MARCA`) | caixa, seta e número desenhados por cima da captura, e a legenda numerada logo abaixo dela |

`legenda()` existe só para isso: é a `lista()` em vermelho, usada depois de cada
`tela()`, para que o número na imagem e o número no texto sejam a mesma coisa aos
olhos. Numeração de tópico continua em `lista()`, azul.

Duas regras que sustentam a marcação:

- **Contorno branco por baixo do vermelho.** A mesma caixa cai ora sobre campo
  claro, ora sobre o azul do cartão; um contorno só falharia em um dos dois fundos.
- **O número não pode pousar na caixa do vizinho.** `tela()` desenha primeiro todas
  as caixas e só depois os números, checando colisão: quando o lugar de costume
  invade outra marcação, o número vai para o canto superior esquerdo da própria
  caixa. Sem isso, o número de "Município" pousava dentro do campo "Nome do
  cliente" e dizia o contrário do que devia.

`numerar: false` desenha a caixa sem número, para quando a frase acima da tela já
explica o que olhar.

O vinho dos proibidos por lei é uma terceira cor, escura, e não disputa com o
vermelho vivo da marcação.

## O link

`LINK`, no topo do montador, é o endereço do atendimento. Ele aparece em destaque
na capa e no rodapé de todas as páginas, e em ambos os lugares é uma anotação
clicável de verdade — quem lê no computador abre o planner do próprio PDF, quem
imprime tem o endereço à mão em qualquer página.
