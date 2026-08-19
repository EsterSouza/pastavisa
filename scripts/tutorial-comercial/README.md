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
