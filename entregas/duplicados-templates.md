# Templates parecidos ou duplicados

Data: 08/10/2026. Base: banco de produção (tabela Template), só leitura.

## Limite desta análise

**Os DOCX não foram abertos.** O bucket `pasta-visa` é privado e só abre com a chave de serviço, que não está no `.env.local` (no `.env.producao` ela vem mascarada pela Vercel). A comparação usou só:

- data de criação, ativo, processingType (todos HEADER_ONLY nos grupos abaixo);
- tamanho do arquivo e hash (eTag) no storage: **nenhum arquivo é cópia exata de outro** nos 360;
- quantos documentos já foram gerados com cada template (usos);
- lote de envio (templates enviados no mesmo minuto formam um conjunto POP + TCLE).

Por isso, toda desativação abaixo é **provisória**: abrir os dois arquivos antes de aplicar. Desativar é `ativo=false`, nunca excluir.

## Decisões por grupo

| Grupo | Fica | Sai (desativar) | Motivo |
|---|---|---|---|
| POP Fios de PDO x Fios de Sustentação de PDO | os dois (conferir) | — | Tamanhos bem diferentes (40 KB x 80 KB) e cada um tem TCLE próprio. Se "Fios de PDO" também falar só de sustentação, desativar o mais antigo. |
| POP Preenchimento com Ácido Hialurônico x Preenchimento Dérmico com Ácido Hialurônico | Dérmico (29/06, 3 usos) | Preenchimento com AH (11/05, 0 usos) | Mesmo procedimento; o novo é o que está em uso e casa com o TCLE. |
| POP Ledterapia x Fototerapia com LED x Fototerapia (Ledterapia) | Fototerapia com LED (23/06, 2 usos, revisado) | Ledterapia (20/05, 0 usos) e Fototerapia (Ledterapia) (01/07, 1 uso) | Mesmo procedimento; o que fica tem TCLE próprio. "Laserterapia e Ledterapia com Máscara" é outra coisa e fica. |
| POP Furo de Orelha Humanizado x Furo de Orelha em Crianças e Adultos x Perfuração Auricular Humanizada | os três (conferir os dois primeiros) | — | Os dois de furo foram criados no mesmo dia, com 4 h de diferença; pode ser revisão. Se forem iguais, sai o "Humanizado". Se o "Humanizado" for para bebês, renomear "POP - Furo de Orelha Humanizado em Bebês". A "Perfuração Auricular" é do conjunto de piercing (lóbulo e cartilagem) e fica. |
| POP Peeling Físico x Peeling de Diamante (Microdermoabrasão) | Peeling de Diamante (16/09, revisado) | Peeling Físico (20/05, 1 uso) | O novo faz par com o TCLE de microdermoabrasão do mesmo dia. Se o antigo falar de outros métodos, manter como "POP - Peeling Físico (Geral)". |
| TCLE Depilação à Cera x Epilação à Cera | Epilação à Cera (17/09) | Depilação à Cera (26/06, 1 uso) | Mesmo procedimento; o POP atual se chama Epilação à Cera. |
| TCLE Plástica dos Pés x Spa dos Pés (Plástica dos Pés) | Spa dos Pés (17/09) | Plástica dos Pés (19/08, 0 usos) | Arquivos com só 24 bytes de diferença: praticamente o mesmo documento. É o caso mais seguro. |
| Administração de Anestésico Local (OUTROS) x POP ... em Saúde Reprodutiva | os dois | — | Nome e tipo POP aplicados como a Ester decidiu, **mas atenção**: o arquivo tem 635 KB, tamanho de TCLE/ficha (POPs têm 30 a 80 KB), e foi enviado no mesmo minuto que o TCLE de anestésico (122 bytes de diferença). Pode ser cópia do TCLE. Abrir antes de mudar o tipo. |
| TCLE Micropigmentação x Micropigmentação Facial | os dois | — | O genérico é o mais usado (3) e veio com o POP de micropigmentação labial; o Facial veio com o POP de dermógrafo. Se o genérico for só labial, renomear "TCLE - Micropigmentação Labial". |
| TCLE Lipo Enzimática x Lipo Enzimática Papada | os dois | — | Variante: o genérico foi renomeado "TCLE - Lipo Enzimática de Gordura Localizada e Glúteos", porque saiu um dia depois desse POP, no mesmo lote. Conferir no texto. |
| TCLE Jato de Plasma x Blefaroplastia / Remoção de Sinais | os três | — | Genérico casa com o POP genérico; os outros têm escopo próprio. |
| TCLE Radiofrequência x Corporal / Íntima | os três | — | Genérico é o mais usado (4) e casa com o POP genérico; os outros são específicos. |

## Outros parecidos encontrados (manter e conferir)

- **POP/TCLE Cavitação (Lipo sem Corte) x Cavitação Ultrassônica**: lipo sem corte costuma ser cavitação. Os dois têm POP e TCLE. Conferir se o texto é o mesmo.
- **POP Drenagem Facial e Corporal x POP Drenagem Linfática**: ambos com 2 usos. Conferir.

## Como conferir rápido

Abrir os dois DOCX lado a lado e olhar: título interno, objetivo, passo a passo e materiais. Mesmo procedimento com texto equivalente → desativar o indicado. Diferença real de escopo → manter os dois e usar o nome de variante.
