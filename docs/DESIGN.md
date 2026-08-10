# Sistema de design — PastaVISA

## Fonte e escopo

Este sistema aplica o **Manual de Marca TreinaVISA 2.0** local, páginas 10 a 12, à Pasta Sanitária. Ele não cria uma marca paralela: Pasta Sanitária é o descritor funcional da superfície interna da TreinaVISA.

O manual PDF é fonte local deste card, permanece ignorado pelo Git e não é redistribuído. O único ativo incorporado é a versão clara oficial já presente nele, em `public/brand/treinavisa-logo-light.png`.

## Marca e uso do logotipo

- Grafia em texto: **TreinaVISA**; em arquivos de marca, pode aparecer em caixa alta.
- A marca oficial não é redesenhada, esticada, filtrada ou convertida em efeito visual.
- Como somente a versão clara foi disponibilizada no checkout, o logotipo sempre aparece sobre navy profundo ou navy institucional. Não há versão escura improvisada.
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

As tonalidades de borda e texto secundário são rampas derivadas dos tokens acima e existem somente como variáveis semânticas em `app/globals.css`. Verde e vermelho são extensões funcionais necessárias para sucesso e erro, como definido pelo manual; cada estado também requer texto claro ou ícone, nunca apenas cor.

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
- `(public)` mantém `/login`; não mostra menu administrativo.
- APIs permanecem fora dos shells de interface.

## Usos proibidos

- Usar âmbar como CTA principal.
- Transformar paleta, tipografia ou logo em uma marca independente para Pasta Sanitária.
- Arredondamento excessivo, glassmorphism, ícones repetidos como decoração, gradiente de texto ou aparência genérica de IA.
- Depender exclusivamente de cor para comunicar sucesso, erro, atenção ou seleção.

## Verificação mínima

- Texto comum: contraste mínimo 4,5:1; texto grande: 3:1.
- Teclado: foco sempre visível, ordem natural e controles acionáveis.
- Layout: verificar 375, 768 e 1440 px, além de 200% de zoom sem perda de conteúdo ou navegação.
