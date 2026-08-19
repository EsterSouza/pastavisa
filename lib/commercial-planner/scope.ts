/**
 * Fronteira do trabalho.
 *
 * A pasta sanitária atende estética, embelezamento e atendimento ambulatorial de
 * baixo risco. Fora dela ficam atividades com outro regime sanitário: saúde bucal,
 * cirurgia, internação, diagnóstico por imagem, análises clínicas, hemoterapia e
 * terapias de alta complexidade.
 *
 * Isso é barrado no código, e não só pedido no prompt: se o cliente declara
 * "lipoaspiração", nenhum POP ou TCLE de lipoaspiração pode ser criado. O comercial
 * recebe um aviso de que aquilo não entra nesta pasta.
 *
 * O cuidado que os padrões exigem é o "não": em estética existe blefaroplastia sem
 * corte, otomodelação não cirúrgica, laserterapia pós-cirúrgica e taping pós-
 * operatório — todos dentro do escopo. Por isso cada acerto é conferido contra o
 * contexto ao redor antes de valer.
 */

interface ScopeGroup {
  /** O que o comercial lê quando o termo aparece. */
  label: string;
  pattern: RegExp;
  /** Vizinhança que desfaz o acerto. Sem isso vale o contexto estético. */
  contexto?: RegExp;
}

/**
 * Contexto que devolve o termo ao escopo. São duas coisas: o "não" que torna a
 * técnica não invasiva ("blefaroplastia sem corte") e o procedimento ambulatorial
 * legítimo cujo nome carrega a palavra-gatilho — retirada de pontos cirúrgicos e
 * curativo são rotina de enfermagem, não cirurgia.
 */
const CONTEXTO_ESTETICO =
  /\b(nao|sem|pos|apos)\b|\bsem corte\b|\bnao invasiv|\bnao cirurgic|\bpos operator|\bpos cirurgic|\bpos procediment|\bretirada de pontos\b|\bcurativo\b|\binstrumental\b|\bferida\w*\b/;

const FORA_DO_ESCOPO: ScopeGroup[] = [
  {
    label: "saúde bucal e odontologia têm regime sanitário próprio e não entram nesta pasta",
    pattern:
      /\b(odontolog\w*|dentist\w*|dent[aá]ri\w*|saude bucal|clareamento dental|ortodont\w*|implante dent\w*|endodont\w*|periodont\w*|protese dent\w*|exodontia|canal dentari\w*)\b/,
  },
  {
    label: "procedimento cirúrgico exige outro tipo de licenciamento e não entra nesta pasta",
    pattern:
      /\b(cirurgia\w*|cirurgic\w*|lipoaspira\w*|lipo hd|abdominoplastia|mamoplastia|mastopexia|rinoplastia|otoplastia|dermolipectomia|enxerto capilar|transplante capilar|implante capilar|centro cirurgico|sala cirurgica|bloco cirurgico)\b/,
  },
  {
    label: "internação e permanência de paciente não entram nesta pasta",
    pattern:
      /\b(internacao|internament\w*|leito\w*|enfermaria|pernoite|curta permanencia|day ?hospital|hospitalar|uti\b|centro de terapia intensiva)\b/,
  },
  {
    label: "diagnóstico por imagem não entra nesta pasta",
    pattern:
      /\b(diagnostico por imagem|radiolog\w*|raio ?x|raios ?x|tomografia|ressonancia|mamografia|densitometria|cintilografia|ultrassonografia|ecografia|doppler|endoscopia|colonoscopia)\b/,
  },
  {
    label: "análises clínicas e laboratório não entram nesta pasta",
    pattern:
      /\b(analises clinicas|laboratorio de analise\w*|exame laboratorial|hemograma|patologia clinica|anatomia patologica|histopatolog\w*|citopatologia laboratorial|biopsia)\b/,
  },
  {
    label: "hemoterapia e banco de sangue não entram nesta pasta",
    pattern: /\b(hemoterapia|banco de sangue|hemocentro|transfusao|transfusional|aferese)\b/,
  },
  {
    label: "terapia de alta complexidade não entra nesta pasta",
    pattern:
      /\b(radioterapia|quimioterapia|dialise|hemodialise|transplante de orgao\w*|medicina nuclear|braquiterapia)\b/,
  },
  {
    label: "farmácia de manipulação e veterinária não entram nesta pasta",
    pattern: /\b(farmacia de manipulacao|manipulacao magistral|farmacia magistral|veterinari\w*|clinica veterinaria)\b/,
  },
];

/**
 * Proibido por lei.
 *
 * Diferente de "fora do escopo": não é atividade de outro regime sanitário, que
 * alguém pode atender com o licenciamento certo. É produto ou prática que a
 * legislação sanitária brasileira não permite para fins estéticos — não gera POP,
 * não gera TCLE, e o comercial precisa saber antes de fechar proposta.
 *
 * Cada linha foi conferida nas páginas oficiais da ANVISA em 19/08/2026:
 * - PMMA: registro só para correção reparadora (sequela de doença, lipodistrofia do
 *   HIV), aplicação por médico ou dentista. Não há indicação estética aprovada.
 *   gov.br/anvisa/pt-br/assuntos/campanhas/estetica/pmma
 * - silicone líquido industrial: uso estético proibido, notícia ANVISA de 2018.
 * - câmara de bronzeamento: RDC 56/2009 proíbe uso, importação, doação, locação e
 *   comercialização para fins estéticos.
 * - formol: permitido em cosmético só como conservante (0,2%) e endurecedor de unha
 *   (5%); como alisante é adulteração. RDC 36/2009 restringe a venda.
 * - preenchedor manipulado: RE 4.424/2023 proíbe manipulação, venda e uso por
 *   farmácia de manipulação.
 * - caneta pressurizada sem agulha: a ANVISA já proibiu os produtos vendidos para
 *   essa aplicação (RE 2.603/2022 e RE 3.274/2022); não há preenchedor registrado
 *   para uso sem agulha.
 *
 * O número da norma fica aqui e no handoff, não no texto que vai ao cliente: norma
 * muda, e número errado na frente do cliente é pior que nenhum.
 */
const PROIBIDOS: ScopeGroup[] = [
  {
    label:
      "preenchimento com PMMA não tem indicação estética aprovada — o registro cobre apenas correção reparadora",
    pattern: /\b(pmma|polimetilmetacrilato|metacrilato|bioplastia)\b/,
  },
  {
    label: "silicone líquido industrial injetável tem uso estético proibido",
    pattern: /\bsilicone (industrial|liquido)\b|\bsilicone injeta\w*/,
  },
  {
    label: "câmara ou cabine de bronzeamento artificial tem uso estético proibido no Brasil",
    pattern: /\b(camara de bronzeament\w*|cabine de bronzeament\w*|bronzeamento artificial|solario|solarium)\b/,
    // Muita casa chama de "artificial" o bronzeamento a jato, que é tópico e não usa
    // radiação: quando isso aparece por perto, o acerto não vale.
    contexto: /\b(jato|spray|autobronzead\w*|topic\w*|natural|pigmentacao)\b/,
  },
  {
    label: "formol como alisante capilar é proibido — em cosmético ele só é permitido como conservante",
    pattern: /\b(formol|formaldeido|aldeido formico)\b/,
    contexto: /\b(sem|nao|livre|isento|zero)\b/,
  },
  {
    label: "preenchedor intradérmico manipulado em farmácia de manipulação é proibido",
    pattern: /\bpreenched\w* manipulad\w*|\bpreenchimento manipulad\w*|\bacido hialuronico manipulad\w*/,
  },
  {
    label: "não existe preenchedor registrado para aplicação por caneta pressurizada, sem agulha",
    pattern: /\bhyaluron pen\b|\bcaneta pressurizada\b|\bpreenchimento sem agulha\b|\bpressurizad\w* sem agulha\b/,
  },
];

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vizinhança do acerto, onde um "não", "sem" ou "pós" muda o sentido. */
function negado(grupo: ScopeGroup, texto: string, indice: number, tamanho: number): boolean {
  const contexto = grupo.contexto ?? CONTEXTO_ESTETICO;
  const antes = texto.slice(Math.max(0, indice - 30), indice);
  const depois = texto.slice(indice + tamanho, indice + tamanho + 30);
  return contexto.test(antes) || contexto.test(depois);
}

interface Acerto {
  grupo: ScopeGroup;
  /** O termo que o cliente escreveu, para saber se já foi comentado. */
  termo: string;
}

function acertos(grupos: ScopeGroup[], texto: string): Acerto[] {
  const normalizado = normalizar(texto);
  const encontrados: Acerto[] = [];

  for (const grupo of grupos) {
    const global = new RegExp(grupo.pattern.source, "g");
    let acerto: RegExpExecArray | null;
    while ((acerto = global.exec(normalizado)) !== null) {
      if (negado(grupo, normalizado, acerto.index, acerto[0].length)) continue;
      encontrados.push({ grupo, termo: acerto[0] });
      break;
    }
  }

  return encontrados;
}

/** Motivo pelo qual a técnica fica fora da pasta, ou null quando ela cabe. */
export function outOfScopeReason(technique: string): string | null {
  return acertos(FORA_DO_ESCOPO, technique)[0]?.grupo.label ?? null;
}

/** Motivo pelo qual a técnica é proibida por lei, ou null quando ela é permitida. */
export function forbiddenReason(technique: string): string | null {
  return acertos(PROIBIDOS, technique)[0]?.grupo.label ?? null;
}

/**
 * Avisos para o que o cliente declarou e não é atendido por esta pasta.
 *
 * Rede de segurança, não porta-voz: quando a análise já explicou aquele termo — e
 * ela costuma explicar melhor, citando o item pelo nome —, o aviso genérico fica
 * calado. Sem isso, três atividades fora do escopo rendiam nove alertas.
 */
export function outOfScopeAlerts(declared: string, existentes: readonly string[] = []): string[] {
  return avisos(
    FORA_DO_ESCOPO,
    declared,
    existentes,
    (label) => `Há atividade declarada que não é atendida por esta pasta: ${label}. Trate esse ponto separadamente com a equipe técnica.`
  );
}

/**
 * Avisos para o que o cliente declarou e a legislação sanitária não permite. Mesma
 * regra de silêncio: se a análise já falou daquele termo, o aviso genérico se cala.
 */
export function forbiddenAlerts(declared: string, existentes: readonly string[] = []): string[] {
  return avisos(
    PROIBIDOS,
    declared,
    existentes,
    (label) => `Atenção à legislação sanitária: ${label}. Isso não gera documento nesta pasta e precisa ser tratado com a equipe técnica antes de qualquer proposta.`
  );
}

function avisos(
  grupos: ScopeGroup[],
  declared: string,
  existentes: readonly string[],
  frase: (label: string) => string
): string[] {
  const comentados = existentes.map(normalizar);

  return acertos(grupos, declared)
    .filter((acerto) => !comentados.some((alerta) => alerta.includes(acerto.termo)))
    .map((acerto) => frase(acerto.grupo.label));
}

/** As fronteiras, para o prompt dizer o mesmo que o código barra. */
export function outOfScopeBlock(): string {
  return FORA_DO_ESCOPO.map((grupo) => `- ${grupo.label}`).join("\n");
}

/** As proibições, idem. */
export function forbiddenBlock(): string {
  return PROIBIDOS.map((grupo) => `- ${grupo.label}`).join("\n");
}
