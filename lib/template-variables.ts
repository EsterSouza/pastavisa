export type TemplateVariableCategory =
  | "Cliente"
  | "Responsável técnico"
  | "Listas e operação"
  | "Documento"
  | "Legislação"
  | "Recursos especiais";

export interface TemplateVariableDefinition {
  key: string;
  tag: string;
  category: TemplateVariableCategory;
  description: string;
  example: string;
  use: string;
  legacy?: boolean;
}

function variable(
  key: string,
  category: TemplateVariableCategory,
  description: string,
  example: string,
  use: string,
  legacy = false
): TemplateVariableDefinition {
  return { key, tag: `{${key}}`, category, description, example, use, legacy };
}

export const TEMPLATE_VARIABLES: TemplateVariableDefinition[] = [
  variable("cliente_nome_fantasia", "Cliente", "Nome fantasia do estabelecimento.", "Clínica Carolina Saldanha", "Capas, cabeçalhos e identificação."),
  variable("cliente_nome_fantasia_upper", "Cliente", "Nome fantasia em letras maiúsculas.", "CLÍNICA CAROLINA SALDANHA", "Títulos e capas."),
  variable("cliente_razao_social", "Cliente", "Razão social cadastrada.", "Carolina Saldanha Serviços de Estética Ltda.", "Dados cadastrais."),
  variable("cliente_razao_social_upper", "Cliente", "Razão social em letras maiúsculas.", "CAROLINA SALDANHA SERVIÇOS DE ESTÉTICA LTDA.", "Capas formais."),
  variable("cliente_cnpj", "Cliente", "CNPJ informado para a cliente.", "12.345.678/0001-90", "Identificacao legal."),
  variable("cliente_endereco", "Cliente", "Endereço completo.", "Rua Exemplo, 100 - Centro", "Identificação do local."),
  variable("cliente_cidade", "Cliente", "Município do estabelecimento.", "Rio de Janeiro", "Datas e identificação."),
  variable("cliente_estado", "Cliente", "Sigla da UF.", "RJ", "Endereco e legislacao."),
  variable("cliente_estado_extenso", "Cliente", "Nome do estado por extenso.", "Rio de Janeiro", "Textos formais."),
  variable("cliente_estado_preposicao", "Cliente", "Preposição adequada ao estado.", "do", "Use em: Estado {cliente_estado_preposicao} {cliente_estado_extenso}."),
  variable("cliente_telefone", "Cliente", "Telefone informado.", "(21) 99999-9999", "Contato."),
  variable("cliente_email", "Cliente", "E-mail informado.", "contato@clinica.com.br", "Contato."),
  variable("cliente_horario", "Cliente", "Horário de funcionamento.", "Segunda a sexta, 09h às 18h", "Rotinas e funcionamento."),
  variable("cliente_logo", "Recursos especiais", "Logo enviada para a cliente.", "[imagem da logo]", "Coloque a tag sozinha no parágrafo onde a imagem deve entrar."),
  variable("cliente_proprietario_nome", "Responsável técnico", "Nome do proprietário quando ele não é o RT.", "Maria Souza", "Identificação legal e assinaturas."),
  variable("cliente_rt_nome", "Responsável técnico", "Nome do responsável técnico.", "Carolina Saldanha", "Assinaturas e responsabilidades."),
  variable("cliente_rt_nome_upper", "Responsável técnico", "Nome do RT em letras maiúsculas.", "CAROLINA SALDANHA", "Capas ou assinatura formal."),
  variable("cliente_rt_profissao", "Responsável técnico", "Profissão do RT.", "Enfermeira", "Identificação profissional."),
  variable("cliente_rt_conselho", "Responsável técnico", "Registro/conselho profissional, quando houver.", "COREN-RJ 123456", "Assinaturas e identificação."),
  variable("cliente_rt_setor", "Responsável técnico", "Setor do RT principal.", "Enfermagem", "Use quando o documento precisa indicar a área do RT."),
  variable("cliente_rts_lista", "Responsável técnico", "Lista de responsáveis técnicos por setor.", "1. Enfermagem | Ana Souza | Enfermeira | COREN-RJ 123", "Responsabilidades por setor."),
  variable("cliente_rts_assinaturas", "Responsável técnico", "Blocos de assinatura dos RTs cadastrados.", "Ana Souza\nEnfermeira\nCOREN-RJ 123\nEnfermagem", "Assinaturas quando há mais de um RT."),
  variable("cliente_tem_conselho", "Recursos especiais", "Condição verdadeira quando o RT possui conselho.", "true", "Use com bloco condicional para ocultar texto quando não houver conselho."),
  variable("cliente_tem_proprietario", "Recursos especiais", "Condição verdadeira quando há proprietário cadastrado.", "true", "Use com bloco condicional para exibir dados do proprietário."),
  variable("cliente_tem_multiplos_rts", "Recursos especiais", "Condição verdadeira quando há mais de um RT cadastrado.", "true", "Use com bloco condicional para documentos com múltiplos RTs."),
  variable("cliente_estrutura_fisica", "Listas e operação", "Descrição da estrutura física.", "Recepção, sala de procedimentos e expurgo.", "MBP e memoriais."),
  variable("cliente_memorial_descritivo_mbp", "Listas e operação", "Memorial descritivo completo informado para MBP.", "Descrição detalhada das áreas...", "Bloco textual do MBP."),
  variable("cliente_servicos_lista", "Listas e operação", "Lista numerada dos serviços.", "1. Limpeza de pele\n2. Microagulhamento", "MBP, POPs e relação de serviços."),
  variable("cliente_funcionarios_lista", "Listas e operação", "Lista de funcionários e registros.", "1. Ana | Técnica | COREN-RJ 123", "Equipe e responsabilidades."),
  variable("cliente_equipamentos_lista", "Listas e operação", "Lista de equipamentos com marca, modelo e ANVISA.", "Autoclave - Marca Modelo (ANVISA: 123)", "Materiais e equipamentos."),
  variable("cliente_produtos_insumos_lista", "Listas e operação", "Lista de produtos, insumos e registros.", "1. Produto | cosmético | registro ANVISA 123", "POP, MBP e protocolos."),
  variable("cliente_terceirizados", "Listas e operação", "Serviços terceirizados cadastrados.", "Coleta de resíduos | Empresa X | CNPJ...", "PGRSS e MBP."),
  variable("cliente_coleta_razao_social", "Listas e operação", "Empresa de coleta de resíduos.", "Coleta Segura Ltda.", "PGRSS."),
  variable("cliente_coleta_cnpj", "Listas e operação", "CNPJ da empresa de coleta.", "98.765.432/0001-10", "PGRSS."),
  variable("cliente_residuos_grupo_a", "Listas e operação", "Quantidade de resíduos do grupo A.", "2 kg/mês", "PGRSS."),
  variable("cliente_residuos_grupo_d", "Listas e operação", "Quantidade de resíduos do grupo D.", "5 kg/mês", "PGRSS."),
  variable("cliente_residuos_grupo_e", "Listas e operação", "Quantidade de resíduos do grupo E.", "1 kg/mês", "PGRSS."),
  variable("equipamento_dermografo_modelo", "Listas e operação", "Modelo do dermógrafo cadastrado.", "Dermógrafo X200", "POPs de micropigmentação."),
  variable("equipamento_dermografo_anvisa", "Listas e operação", "Registro ANVISA do dermógrafo.", "123456789", "POPs de micropigmentação."),
  variable("autoclave_modelo", "Listas e operação", "Modelo da autoclave cadastrada.", "Autoclave 12L", "Esterilização."),
  variable("autoclave_anvisa", "Listas e operação", "Registro ANVISA da autoclave.", "123456789", "Esterilização."),
  variable("pigmento_marilyn_anvisa", "Listas e operação", "Campo reservado para registro de pigmento.", "", "Use apenas quando o dado estiver preenchido na geração."),
  variable("agulha_anvisa", "Listas e operação", "Campo reservado para registro de agulha.", "", "Use apenas quando o dado estiver preenchido na geração."),
  variable("doc_emissao", "Documento", "Mês e ano de emissão.", "05/2026", "Cabeçalho e controle documental."),
  variable("doc_revisao_1ano", "Documento", "Revisão automática em um ano.", "05/2027", "Controle de revisão."),
  variable("doc_revisao_2anos", "Documento", "Revisão automática em dois anos.", "05/2028", "Controle de revisão."),
  variable("doc_versao", "Documento", "Número da versão gerada.", "2", "Controle documental."),
  variable("doc_elaborador", "Documento", "Nome do elaborador definido na pasta.", "Carolina Saldanha", "Assinatura e cabeçalho."),
  variable("doc_mes_extenso", "Documento", "Mês de elaboração por extenso.", "maio", "Datas por extenso."),
  variable("doc_ano", "Documento", "Ano de elaboração.", "2026", "Datas por extenso."),
  variable("documentos_a_gerar", "Documento", "Lista dos documentos incluídos na pasta.", "- MBP\n- PGRSS\n- POP Higienização", "Guia ou índice da entrega."),
  variable("texto_legislacao_federal", "Legislação", "Referências federais associadas à pasta, formatadas.", "BRASIL. Resolução RDC...", "Seção de referências."),
  variable("texto_legislacao_estadual", "Legislação", "Referências estaduais associadas à pasta, formatadas.", "RIO DE JANEIRO. Lei...", "Seção de referências."),
  variable("texto_legislacao_municipal", "Legislação", "Referências municipais associadas à pasta, formatadas.", "RIO DE JANEIRO (Município). Decreto...", "Seção de referências."),
  variable("CLIENTE_NOME_FANTASIA_UPPER", "Cliente", "Alias antigo para nome fantasia em maiúsculas.", "CLÍNICA CAROLINA SALDANHA", "Compatibilidade com templates antigos.", true),
];

export const TEMPLATE_VARIABLE_CATEGORIES: TemplateVariableCategory[] = [
  "Cliente",
  "Responsável técnico",
  "Listas e operação",
  "Documento",
  "Legislação",
  "Recursos especiais",
];

export interface TemplateSyntaxDefinition {
  label: string;
  syntax: string;
  description: string;
  example: string;
}

export const TEMPLATE_SPECIAL_SYNTAX: TemplateSyntaxDefinition[] = [
  {
    label: "Bloco condicional",
    syntax: "{#cliente_tem_conselho}...{/cliente_tem_conselho}",
    description: "Mostra o trecho somente quando a cliente possui conselho profissional preenchido.",
    example: "Registro: {#cliente_tem_conselho}{cliente_rt_conselho}{/cliente_tem_conselho}",
  },
  {
    label: "Bloco adaptado por IA",
    syntax: "[AI_ADAPT_START] ... [AI_ADAPT_END]",
    description: "O texto entre os marcadores vira instrução para gerar ou adaptar aquele trecho.",
    example: "[AI_ADAPT_START]Descreva os serviços: {cliente_servicos_lista}[AI_ADAPT_END]",
  },
];

const variableMap = new Map(TEMPLATE_VARIABLES.map((item) => [item.key, item]));

export function findTemplateVariable(key: string): TemplateVariableDefinition | undefined {
  return variableMap.get(key);
}

export function isSupportedTemplateVariable(key: string): boolean {
  return variableMap.has(key);
}
