// O "Documentos em elaboração" que a Ester manda para a cliente no início do projeto.
// A estrutura é a soma do que os planejamentos mais recentes trazem (ela vai
// acrescentando blocos de um mês para o outro); bloco sem conteúdo some do documento,
// e campo sem valor fica só com o rótulo.

export interface CampoRotulado {
  rotulo: string;
  valor: string;
}

export interface SecaoDocumentos {
  /** Sem o algarismo romano, que o gerador numera na ordem. Ex.: "POPs - PRÁTICAS INTEGRATIVAS E COMPLEMENTARES". */
  titulo: string;
  itens: string[];
}

export interface EquipamentoPlanejado {
  /** E01, E02... */
  id: string;
  nome: string;
  marca: string;
  serie: string;
  registroAnvisa: string;
}

export interface InsumoPlanejado {
  /** I01, I02... */
  id: string;
  nome: string;
  marca: string;
}

export interface LinhaMatriz {
  /** P01, P02... */
  id: string;
  procedimento: string;
  /** IDs dos equipamentos (E01, E02), "Equipamento NÃO INFORMADO" ou "Não se aplica". */
  equipamentos: string;
  /** IDs dos insumos; só aparece quando há tabela de insumos. */
  insumos?: string;
}

export interface AtividadeCnae {
  tipo: "Principal" | "Secundária";
  codigo: string;
  descricao: string;
}

export interface ReferenciaPlanejada {
  /** Citação ABNT sem o "Disponível em: <url>." do fim. */
  texto: string;
  url?: string;
  /** Trecho em negrito pela NBR 6023 (epígrafe do ato, título, periódico). */
  destaque?: string;
  /** Só para a tela: o banco ainda não conferiu este ato na fonte. Não vai para o DOCX. */
  naoConferida?: boolean;
}

export interface GrupoReferencias {
  /** Sem o número, que o gerador põe na ordem. Ex.: "LEGISLAÇÃO DO ESTADO DO RIO DE JANEIRO". */
  titulo: string;
  itens: ReferenciaPlanejada[];
}

export interface Planejamento {
  /** Nome usado nos títulos das tabelas e no rodapé (nome fantasia ou da titular). */
  nomeCliente: string;
  /** "Rio de Janeiro/RJ", para o rodapé. */
  cidadeUf: string;
  introducao: string;
  /** Data do planejamento, prazos e status: as primeiras linhas do documento. */
  cronograma: CampoRotulado[];
  identificacao: CampoRotulado[];
  /** Parágrafos da estrutura física. */
  estruturaFisica: string[];
  terceirizados: CampoRotulado[];
  procedimentos: string[];
  secoes: SecaoDocumentos[];
  /** Destaque amarelo "PRAZO DE CONFECÇÃO" depois das seções. */
  avisoPrazo: boolean;
  equipamentos: EquipamentoPlanejado[];
  insumos: InsumoPlanejado[];
  matriz: LinhaMatriz[];
  referencias: GrupoReferencias[];
  cnaes: AtividadeCnae[];
}
