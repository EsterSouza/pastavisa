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

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vizinhança do acerto, onde um "não", "sem" ou "pós" muda o sentido. */
function negado(texto: string, indice: number, tamanho: number): boolean {
  const antes = texto.slice(Math.max(0, indice - 30), indice);
  const depois = texto.slice(indice + tamanho, indice + tamanho + 30);
  return CONTEXTO_ESTETICO.test(antes) || CONTEXTO_ESTETICO.test(depois);
}

function acertos(texto: string): ScopeGroup[] {
  const normalizado = normalizar(texto);
  const encontrados: ScopeGroup[] = [];

  for (const grupo of FORA_DO_ESCOPO) {
    const global = new RegExp(grupo.pattern.source, "g");
    let acerto: RegExpExecArray | null;
    while ((acerto = global.exec(normalizado)) !== null) {
      if (negado(normalizado, acerto.index, acerto[0].length)) continue;
      encontrados.push(grupo);
      break;
    }
  }

  return encontrados;
}

/** Motivo pelo qual a técnica fica fora da pasta, ou null quando ela cabe. */
export function outOfScopeReason(technique: string): string | null {
  return acertos(technique)[0]?.label ?? null;
}

/** Avisos para o que o cliente declarou e não é atendido por esta pasta. */
export function outOfScopeAlerts(declared: string): string[] {
  return acertos(declared).map(
    (grupo) => `Há atividade declarada que não é atendida por esta pasta: ${grupo.label}. Trate esse ponto separadamente com a equipe técnica.`
  );
}

/** As fronteiras, para o prompt dizer o mesmo que o código barra. */
export function outOfScopeBlock(): string {
  return FORA_DO_ESCOPO.map((grupo) => `- ${grupo.label}`).join("\n");
}
