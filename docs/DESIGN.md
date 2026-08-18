# Sistema de design — PastaVISA

## Fonte e escopo

Este sistema aplica o **Manual de Marca TreinaVISA 2.0** local, páginas 10 a 12, à Pasta Sanitária. Ele não cria uma marca paralela: Pasta Sanitária é o descritor funcional da superfície interna da TreinaVISA.

O manual PDF é fonte local deste card, permanece ignorado pelo Git e não é redistribuído. Os ativos oficiais claro, escuro e favicons ficam em `public/brand/` e são usados sem recoloração.

## Marca e uso do logotipo

- Grafia em texto: **TreinaVISA**; em arquivos de marca, pode aparecer em caixa alta.
- A marca oficial não é redesenhada, esticada, filtrada ou convertida em efeito visual.
- Em superfície clara, usar `treinavisa-logo-on-light.png`; em superfície escura, usar `treinavisa-logo-on-dark.png`.
- O tema respeita inicialmente a preferência do sistema e permite escolha manual persistida no navegador.
- “Pasta Sanitária” é texto de produto, não um logotipo novo.

## Paleta institucional

| Token | Valor do manual | Papel |
| --- | --- | --- |
| `brand.deep` | `#07182E` | Fundo de impacto e shell escuro |
| `brand.navy` | `#0B1F3A` | Texto, títulos e estrutura |
| `brand.action` | `#244A9B` | Ação principal e reconhecimento |
| `brand.focus` | `#6F95F6` | Foco e ação em fundo escuro |
| `brand.pale` | `#EAF3FC` | Fundo de leitura e orientação |
| `surface.card` | `#FFFFFF` | Superfícies e respiro |
| `brand.amber` | `#D99721` | Atenção, prazo e destaque semântico |
| `brand.accent` | `#244A9B` claro / `#8FB0FF` escuro | Texto de acento sobre a superfície da página |

As tonalidades de borda e texto secundário são rampas derivadas dos tokens acima e existem somente como variáveis semânticas em `app/globals.css`. Verde e vermelho são extensões funcionais necessárias para sucesso e erro, como definido pelo manual; cada estado também requer texto claro ou ícone, nunca apenas cor.

Sucesso, erro e atenção têm dois valores: o tom forte do manual serve ao tema claro, e uma versão clareada entra no tema escuro. Sem isso o mesmo token cai para cerca de 2,3:1 sobre o fundo escuro. Pela mesma razão o azul de ação vira `brand.accent` quando é texto sobre a página, e a cor herdada de `html`/`body` é `ink`, não o navy fixo.

## Tipografia e hierarquia

- **Sora 500:** títulos digitais, capítulos e destaques curtos.
- **Source Sans 3 400/500:** interface, formulários e leitura.
- **Segoe UI:** fallback de escritório.
- Dados técnicos usam a mesma família de corpo; monoespaçada não comunica rigor por si só.

O título de página é o principal ponto de entrada. Rótulos, mensagens de apoio e metadados usam Source Sans 3 em hierarquia menor, sempre mantendo contraste AA.

## Espaçamento, superfícies e componentes

O manual não define uma grade ou uma medida numérica de margem para produto. Por isso, não existe uma “margem oficial” inventada: os shells usam gutters responsivos para preservar leitura e toque em 375, 768 e 1440 px, enquanto cada fluxo continua responsável por sua densidade operacional.

- Fundo claro profissional: branco, azul muito claro e navy para estrutura.
- Bordas discretas, raio moderado e sombra apenas para separação funcional.
- `Button` usa ação principal ou secundária; controles, navegação e CTA têm alvo mínimo de 44 px.
- Foco visível usa azul claro com offset; transições são curtas e respeitam redução de movimento.
- Camadas usam escala semântica: popover, overlay, modal, toast e tooltip.

## Shells e rotas

- `(internal)` mantém a URL de `/`, `/pasta/*`, `/templates` e `/legislacoes`; aplica navegação responsiva da Pasta Sanitária.
- `(public)` mantém `/login` e `/planner`; não mostra menu administrativo. Em `/planner` a marca não é link: o endereço é público e mandar quem abre para o login interno seria um convite errado.
- APIs permanecem fora dos shells de interface.

## Planner comercial público

O link público é um fluxo de quatro etapas — cliente e local, operação declarada, revisão, formato e preço — com a
trilha de etapas anunciada por `aria-current="step"`. Os blocos:

- **Etapas:** numeradas, com estado concluído redundante em texto para leitor de tela.
- **Campos:** rótulo acima, dica abaixo, alvo mínimo de 44 px; escolhas de sim/não em `fieldset` com `legend`.
- **Revisão:** duas colunas em telas largas — procedimentos com caixa de seleção e documentos recalculados —
  com contagens em região `aria-live` e alertas em bloco de atenção.
- **Formato e preço:** três cartões de rádio comparáveis e um resumo com base, adicional e total.
- **Rascunho:** o preenchimento fica no `localStorage` de quem atende por duas horas — a mesma validade do token
  assinado da análise. Recarregar a página, cair a conexão ou fechar a aba não custa o atendimento. Ao retomar,
  um aviso `role="status"` diz o que aconteceu, e o botão **Recomeçar do zero** apaga o rascunho e limpa a tela.
  Nada disso vai para o servidor: o rascunho nasce e morre no navegador.

## Composição do PDF

O PDF A4 usa a mesma paleta e as mesmas famílias da interface: **Sora** no título, nos títulos de seção e no total;
**Source Sans 3** em texto, listas e tabelas. As fontes ficam em `public/brand/fonts/` sob a licença OFL, junto do
recorte da logo oficial para superfície escura (`treinavisa-logo-print.png`, corte da margem transparente, sem
recoloração). Sem esses arquivos o PDF ainda sai, com a fallback de escritório.

Os documentos aparecem com o nome oficial da pasta, e não com o nome do arquivo de origem: POP e TCLE de
procedimento são nomeados pela técnica declarada, e os institucionais, POPs gerais e registros têm nome próprio
em `lib/commercial-planner/naming.ts`. A base obrigatória da pasta — institucionais, POPs gerais de biossegurança,
fichas e planilhas de controle — vem de `lib/commercial-planner/baseline.ts` e entra sempre, com as entradas de
injetáveis, perfuração, equipamento e esterilização condicionadas ao que o cliente declarou.

O PDF fecha com as principais referências federais, a nota sobre normativas locais, o mapeamento semestral das
referências acadêmicas e o critério da especialista sobre técnica sem evidência ou com legislação desfavorável
(`lib/commercial-planner/references.ts`).

A página tem faixa navy com a marca, filete âmbar, bloco de cliente em azul pálido, seções tituladas com filete,
selo de tipo por documento, bloco de investimento em navy e marca-d'água diagonal `PRÉ-PLANEJAMENTO PROVISÓRIO`
em todas as páginas. Título de seção nunca fica órfão: cada um reserva a altura do primeiro bloco.

## Usos proibidos

- Usar âmbar como CTA principal.
- Transformar paleta, tipografia ou logo em uma marca independente para Pasta Sanitária.
- Arredondamento excessivo, glassmorphism, ícones repetidos como decoração, gradiente de texto ou aparência genérica de IA.
- Depender exclusivamente de cor para comunicar sucesso, erro, atenção ou seleção.

## Verificação mínima

- Texto comum: contraste mínimo 4,5:1; texto grande: 3:1.
- Teclado: foco sempre visível, ordem natural e controles acionáveis.
- Layout: verificar 375, 768 e 1440 px, além de 200% de zoom sem perda de conteúdo ou navegação.
