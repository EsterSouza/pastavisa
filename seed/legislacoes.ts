// seed/legislacoes.ts
// Fonte de verdade de todas as legislações do PastaVISA.
// Para importar: npx tsx seed/run.ts

const legislacoes = [

  // ═══════════════════════════════════════════════════════════════════
  // FEDERAL — sempre citadas, todos os estabelecimentos
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 8.078/1990 — Código de Defesa do Consumidor",
    referenciaAbnt: `BRASIL. Lei nº 8.078, de 11 de setembro de 1990. Dispõe sobre a proteção do consumidor e dá outras providências. Brasília, DF, 1990. Disponível em: http://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 8.080/1990 — Lei Orgânica da Saúde",
    referenciaAbnt: `BRASIL. Lei nº 8.080, de 19 de setembro de 1990. Dispõe sobre as condições para a promoção, proteção e recuperação da saúde, a organização e o funcionamento dos serviços correspondentes. Brasília, DF, 1990. Disponível em: http://www.planalto.gov.br/ccivil_03/leis/l8080.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 12.305/2010 — Política Nacional de Resíduos Sólidos",
    referenciaAbnt: `BRASIL. Lei nº 12.305, de 2 de agosto de 2010. Institui a Política Nacional de Resíduos Sólidos e dá outras providências. Brasília, DF, 2010. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12305.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 12.592/2012 — Atividades de embelezamento",
    referenciaAbnt: `BRASIL. Lei nº 12.592, de 18 de janeiro de 2012. Dispõe sobre o exercício das atividades profissionais de Cabeleireiro, Barbeiro, Esteticista, Manicure, Pedicure, Depilador e Maquiador. Brasília, DF, 2012. Disponível em: http://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12592.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 13.643/2018 — Esteticista e Cosmetólogo",
    referenciaAbnt: `BRASIL. Lei nº 13.643, de 3 de abril de 2018. Regulamenta as profissões de Esteticista, que compreende o Esteticista e Cosmetólogo, e de Técnico em Estética. Brasília, DF, 2018. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13643.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 13.709/2018 — LGPD",
    referenciaAbnt: `BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais. Brasília, DF, 2018. Disponível em: http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 14.648/2023 — Ozonioterapia",
    referenciaAbnt: `BRASIL. Lei nº 14.648, de 4 de agosto de 2023. Autoriza a ozonioterapia no território nacional. Brasília, DF, 2023. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14648.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 14.737/2023 — Direito ao acompanhante em serviços de saúde",
    referenciaAbnt: `BRASIL. Lei nº 14.737, de 27 de novembro de 2023. Amplia o direito da mulher de ter acompanhante nos atendimentos realizados em serviços de saúde públicos e privados. Brasília, DF, 2023. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14737.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 15.378/2026 — Estatuto dos Direitos do Paciente",
    referenciaAbnt: `BRASIL. Lei nº 15.378, de 27 de março de 2026. Institui o Estatuto dos Direitos do Paciente. Brasília, DF, 2026. Disponível em: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15378.htm`,
  },

  // ── ANVISA — RDCs sempre citadas ─────────────────────────────────

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 50/2002 — Projetos físicos de estabelecimentos de saúde",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 50, de 21 de fevereiro de 2002. Dispõe sobre o Regulamento Técnico para planejamento, programação, elaboração e avaliação de projetos físicos de estabelecimentos assistenciais de saúde. Brasília, DF, 2002. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2002/rdc0050_21_02_2002.html`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 55/2008 — Pigmentação artificial permanente da pele",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 55, de 6 de agosto de 2008. Dispõe sobre o registro de produtos utilizados no procedimento de pigmentação artificial permanente da pele, e dá outras providências. Brasília, DF, 2008. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2008/rdc0055_06_08_2008.html`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 63/2011 — Boas Práticas de Funcionamento para Serviços de Saúde",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 63, de 25 de novembro de 2011. Dispõe sobre os Requisitos de Boas Práticas de Funcionamento para os Serviços de Saúde. Brasília, DF, 2011. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2011/rdc0063_25_11_2011.html`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 15/2012 — Processamento de produtos para saúde",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 15, de 15 de março de 2012. Dispõe sobre requisitos de boas práticas para o processamento de produtos para saúde e dá outras providências. Brasília, DF, 2012. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2012/rdc0015_15_03_2012.html`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 222/2018 — PGRSS",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 222, de 28 de março de 2018. Regulamenta as Boas Práticas de Gerenciamento dos Resíduos de Serviços de Saúde e dá outras providências. Brasília, DF, 2018. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/anvisa/2018/rdc0222_28_03_2018.pdf`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 509/2021 — Gerenciamento de tecnologias em saúde",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 509, de 27 de maio de 2021. Dispõe sobre o gerenciamento de tecnologias em saúde em estabelecimentos de saúde. Brasília, DF, 2021. Disponível em: https://www.in.gov.br/en/web/dou/-/resolucao-rdc-n-509-de-27-de-maio-de-2021-323002941`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "RDC nº 622/2022 — Empresas de controle de vetores e pragas urbanas",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Agência Nacional de Vigilância Sanitária. Resolução da Diretoria Colegiada - RDC nº 622, de 9 de março de 2022. Dispõe sobre o funcionamento de empresas especializadas na prestação de serviço de controle de vetores e pragas urbanas. Brasília, DF, 2022. Disponível em: https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000622&sgl_tipo=RDC&sgl_orgao=RDC/DC/ANVISA/MS&vlr_ano=2022&seq_ato=000&cod_modulo=134&cod_menu=1696`,
  },

  // ── NRs ──────────────────────────────────────────────────────────

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "NR-6 — Equipamentos de Proteção Individual",
    referenciaAbnt: `BRASIL. Ministério do Trabalho e Emprego. Norma Regulamentadora nº 6 (NR-6). Equipamentos de Proteção Individual. Brasília, DF, 2022. Disponível em: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-06.pdf`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "NR-32 — Segurança e Saúde no Trabalho em Serviços de Saúde",
    referenciaAbnt: `BRASIL. Ministério do Trabalho e Emprego. Norma Regulamentadora nº 32 (NR-32). Segurança e Saúde no Trabalho em Serviços de Saúde. Brasília, DF, 2005. Disponível em: https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/nr-32-atualizada-2023-1.pdf`,
  },

  // ── Portarias ────────────────────────────────────────────────────

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Portaria nº 2048/2002 — Urgência e Emergência",
    referenciaAbnt: `BRASIL. Ministério da Saúde. Portaria nº 2.048, de 5 de novembro de 2002. Aprova o Regulamento Técnico dos Sistemas Estaduais de Urgência e Emergência. Brasília, DF, 2002. Disponível em: https://bvsms.saude.gov.br/bvs/saudelegis/gm/2002/prt2048_05_11_2002.html`,
  },

  // ── Leis específicas para enfermagem ─────────────────────────────

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Lei nº 7.498/1986 — Exercício da Enfermagem",
    referenciaAbnt: `BRASIL. Lei nº 7.498, de 25 de junho de 1986. Dispõe sobre a regulamentação do exercício da enfermagem e dá outras providências. Brasília, DF, 1986. Disponível em: http://www.planalto.gov.br/ccivil_03/leis/l7498.htm`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal",
    titulo: "Decreto nº 94.406/1987 — Regulamenta Lei de Enfermagem",
    referenciaAbnt: `BRASIL. Decreto nº 94.406, de 8 de junho de 1987. Regulamenta a Lei nº 7.498, de 25 de junho de 1986, que dispõe sobre o exercício da enfermagem, e dá outras providências. Brasília, DF, 1987. Disponível em: https://www.planalto.gov.br/ccivil_03/decreto/1980-1989/d94406.htm`,
  },

  // ── COFEN ────────────────────────────────────────────────────────

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 564/2017 — Código de Ética de Enfermagem",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 564, de 6 de novembro de 2017. Aprova o novo Código de Ética dos Profissionais de Enfermagem. Brasília, DF, 2017. Disponível em: http://www.cofen.gov.br/resolucao-cofen-no-5642017_59145.html`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 568/2018 — Consultórios e Clínicas de Enfermagem",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 568, de 9 de fevereiro de 2018. Aprova o Regulamento dos Consultórios de Enfermagem e Clínicas de Enfermagem. Brasília, DF, 2018. Disponível em: https://www.cofen.gov.br/resolucao-cofen-no-0568-2018/`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 626/2020 — Enfermeiro em Estética",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 626, de 20 de fevereiro de 2020. Regulamenta a atuação do Enfermeiro na área da Estética. Brasília, DF, 2020. Disponível em: http://www.cofen.gov.br/resolucao-cofen-no-626-2020_77398.html`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Parecer Normativo COFEN nº 001/2020 — Enfermeiro em Ozonioterapia",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Parecer Normativo nº 001, de 17 de janeiro de 2020. Dispõe sobre a atuação do Enfermeiro na Ozonioterapia. Brasília, DF, 2020. Disponível em: https://www.cofen.gov.br/parecer-normativo-no-001-2020/`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 713/2022 — Atendimento Pré-Hospitalar",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 713, de 8 de novembro de 2022. Atualiza a norma de atuação dos profissionais de enfermagem no Atendimento Pré-Hospitalar móvel Terrestre e Aquaviário. Brasília, DF, 2022. Disponível em: https://www.cofen.gov.br/resolucao-cofen-no-713-2022/`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 736/2024 — Processo de Enfermagem (SAE)",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 736, de 17 de janeiro de 2024. Dispõe sobre a implementação do Processo de Enfermagem em todo contexto socioambiental onde ocorre o cuidado de enfermagem e revoga a Resolução COFEN nº 358/2009. Brasília, DF, 2024. Disponível em: https://www.cofen.gov.br/resolucao-cofen-no-736-de-17-de-janeiro-de-2024/`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 739/2024 — Práticas Integrativas e Complementares",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 739, de 5 de fevereiro de 2024. Normatiza a atuação da Enfermagem nas Práticas Integrativas e Complementares em Saúde. Brasília, DF, 2024. Disponível em: https://www.cofen.gov.br/resolucao-cofen-no-739-de-05-de-fevereiro-de-2024/`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 787/2025 — Lesões Cutâneas",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 787, de 21 de agosto de 2025. Regulamenta a atuação da equipe de enfermagem na promoção, prevenção, tratamento e reabilitação de pessoas com Lesões Cutâneas. Brasília, DF, 2025. Disponível em: https://www.cofen.gov.br/resolucao-cofen-no-787-de-21-de-agosto-de-2025/`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_profissional",
    titulo: "Resolução COFEN nº 801/2026 — Prescrição de medicamentos pelo enfermeiro",
    referenciaAbnt: `CONSELHO FEDERAL DE ENFERMAGEM. Resolução COFEN nº 801, de 14 de janeiro de 2026. Estabelece diretrizes para a prescrição de medicamentos pelo enfermeiro, e dá outras providências. Brasília, DF, 2026. Disponível em: https://www.cofen.gov.br/resolucao-cofen-no-801-de-14-de-janeiro-de-2026/`,
  },

  // ── Publicações técnicas ANVISA ───────────────────────────────────

  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_tecnico",
    titulo: "ANVISA — Manual de Limpeza e Desinfecção de Superfícies (2012)",
    referenciaAbnt: `BRASIL. Agência Nacional de Vigilância Sanitária. Segurança do paciente em serviços de saúde: limpeza e desinfecção de superfícies. Brasília: ANVISA, 2012. Disponível em: https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/publicacoes/manual-de-limpeza-e-desinfeccao-de-superficies.pdf`,
  },
  {
    estadoUf: "BR",
    municipio: null,
    tipo: "federal_tecnico",
    titulo: "SES-MG — Manual de Biossegurança para Serviços de Embelezamento (2024)",
    referenciaAbnt: `MINAS GERAIS. Secretaria de Estado de Saúde. Manual de Biossegurança para os Serviços de Embelezamento/Estética, Podologia, Colocação de Piercing, Pigmentação Artificial da Pele e Afins. Belo Horizonte, 2024. Disponível em: https://docs.uberlandia.mg.gov.br/wp-content/uploads/2024/12/Manual-de-Biosseguranca-para-os-servicos-de-embelezamento.pdf`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO DO RIO DE JANEIRO
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "RJ",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei Complementar nº 197/2018 — Código Sanitário do Município do Rio de Janeiro",
    referenciaAbnt: `RIO DE JANEIRO (Município). Lei Complementar nº 197, de 26 de setembro de 2018. Institui o Código Sanitário do Município do Rio de Janeiro e dá outras providências. Diário Oficial do Município, Rio de Janeiro, RJ, 27 set. 2018. Disponível em: https://leismunicipais.com.br/a/rj/r/rio-de-janeiro/lei-complementar/2018/20/197`,
  },
  {
    estadoUf: "RJ",
    municipio: "Rio de Janeiro",
    tipo: "municipal",
    titulo: "Decreto Municipal nº 23.915/2004 — Licenciamento sanitário salões de beleza e estética (Rio de Janeiro)",
    referenciaAbnt: `RIO DE JANEIRO (Município). Decreto Municipal nº 23.915, de 13 de janeiro de 2004. Dispõe sobre o licenciamento sanitário a que estão sujeitos os salões de cabeleireiros, os institutos de beleza, estética, podologia e estabelecimentos congêneres; cria normas e procedimentos específicos para a proteção da saúde dos usuários. Diário Oficial do Município, Rio de Janeiro, RJ, 13 jan. 2004.`,
  },
  {
    estadoUf: "RJ",
    municipio: "Rio de Janeiro",
    tipo: "municipal",
    titulo: "Decreto Municipal nº 45.585/2018 — Vigilância Sanitária Municipal Rio de Janeiro",
    referenciaAbnt: `RIO DE JANEIRO (Município). Decreto nº 45.585, de 26 de setembro de 2018. Regulamenta a Lei Complementar nº 197/2018, que institui o Código Sanitário do Município do Rio de Janeiro. Diário Oficial do Município, Rio de Janeiro, RJ, 27 set. 2018. Disponível em: https://doweb.rio.rj.gov.br/apifront/portal/edicoes/imprimir_texto/502027`,
  },
  {
    estadoUf: "RJ",
    municipio: "Rio de Janeiro",
    tipo: "municipal",
    titulo: "Decreto Rio nº 57.501/2026 — Código Sanitário do Rio de Janeiro (atualização 2026)",
    referenciaAbnt: `RIO DE JANEIRO (Município). Decreto Rio nº 57.501, de 30 de janeiro de 2026. Atualiza o Código Sanitário do Município do Rio de Janeiro. Diário Oficial do Município, Rio de Janeiro, RJ, 30 jan. 2026. Disponível em: https://leis.org/32uo0`,
  },
  {
    estadoUf: "RJ",
    municipio: "Rio de Janeiro",
    tipo: "municipal",
    titulo: "Resolução SMS nº 2.748/2011 — Licenciamento sanitário embelezamento e esteticismo (Rio de Janeiro)",
    referenciaAbnt: `RIO DE JANEIRO (Município). Resolução SMS nº 2.748, de 2011. Dispõe sobre o Licenciamento Sanitário a que estão sujeitos os estabelecimentos de embelezamento e de esteticismo e os congêneres de interesse à saúde; estabelece procedimentos específicos para a proteção da saúde dos usuários e dos profissionais. Rio de Janeiro, RJ, 2011.`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO DE SÃO PAULO
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "SP",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei nº 10.083/1998 — Código Sanitário do Estado de São Paulo",
    referenciaAbnt: `SÃO PAULO (Estado). Lei nº 10.083, de 23 de setembro de 1998. Dispõe sobre o Código Sanitário do Estado de São Paulo. Diário Oficial do Estado de São Paulo, São Paulo, SP, 24 set. 1998. Disponível em: https://www.al.sp.gov.br/repositorio/legislacao/lei/1998/lei-10083-23.09.1998.html`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO DO PARANÁ
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "PR",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei nº 13.331/2001 — Código de Saúde do Paraná",
    referenciaAbnt: `PARANÁ. Assembleia Legislativa. Lei nº 13.331, de 23 de novembro de 2001. Dispõe sobre a organização, regulamentação, fiscalização e controle das ações dos serviços de saúde no Estado do Paraná. Diário Oficial do Estado do Paraná, Curitiba, PR, 23 nov. 2001. Disponível em: https://www.legislacao.pr.gov.br/legislacao/pesquisarAto.do?action=exibir&codAto=4775`,
  },
  {
    estadoUf: "PR",
    municipio: null,
    tipo: "estadual",
    titulo: "Decreto nº 5.711/2002 — Regulamenta Código de Saúde do Paraná",
    referenciaAbnt: `PARANÁ. Decreto nº 5.711, de 5 de maio de 2002. Regulamenta a Lei nº 13.331, de 23 de novembro de 2001, que dispõe sobre as ações dos serviços de saúde no Estado do Paraná. Diário Oficial do Estado do Paraná, Curitiba, PR, 6 maio 2002. Disponível em: https://www.legislacao.pr.gov.br/legislacao/pesquisarAto.do?action=exibir&codAto=18285`,
  },
  {
    estadoUf: "PR",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei Estadual nº 18.925/2016 — Responsável técnico em estética e cosmetologia (PR)",
    referenciaAbnt: `PARANÁ. Assembleia Legislativa. Lei nº 18.925, de 2016. Dispõe sobre a responsabilidade técnica nos estabelecimentos de estética e cosmetologia. Diário Oficial do Estado do Paraná, Curitiba, PR, 2016.`,
  },
  {
    estadoUf: "PR",
    municipio: null,
    tipo: "estadual_tecnico",
    titulo: "Nota Técnica SESA/PR nº 001/2018 — Estética e Embelezamento",
    referenciaAbnt: `PARANÁ. Secretaria de Estado da Saúde. Nota Técnica nº 001, de 15 de janeiro de 2018. Orienta sobre os procedimentos de estética a serem desenvolvidos em estabelecimentos de interesse à saúde e os profissionais habilitados para executá-los. Curitiba, PR, 2018. Disponível em: https://www.saude.pr.gov.br/sites/default/arquivos_restritos/files/documento/2020-05/notatecnica_estetica2018.pdf`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO DE SANTA CATARINA
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "SC",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei nº 6.320/1983 — Código Sanitário do Estado de Santa Catarina",
    referenciaAbnt: `SANTA CATARINA. Assembleia Legislativa. Lei nº 6.320, de 20 de dezembro de 1983. Dispõe sobre normas sanitárias no Estado de Santa Catarina (Código Sanitário). Diário Oficial do Estado de Santa Catarina, Florianópolis, SC, 20 dez. 1983. Disponível em: https://leisestaduais.com.br/sc/lei-ordinaria-n-6320-1983-santa-catarina`,
  },
  {
    estadoUf: "SC",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei nº 18.630/2023 — Centros de saúde estética em Santa Catarina",
    referenciaAbnt: `SANTA CATARINA. Assembleia Legislativa. Lei nº 18.630, de 30 de janeiro de 2023. Dispõe sobre os centros de saúde estética e dá outras providências. Diário Oficial do Estado de Santa Catarina, Florianópolis, SC, 30 jan. 2023. Disponível em: https://www.legisweb.com.br/legislacao/?id=441987`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO DO AMAZONAS
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "AM",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei Complementar nº 70/2009 — Código de Saúde do Amazonas",
    referenciaAbnt: `AMAZONAS. Assembleia Legislativa. Lei Complementar nº 70, de 3 de dezembro de 2009. Institui, no âmbito do Estado do Amazonas, o Código de Saúde e dá outras providências. Diário Oficial do Estado do Amazonas, Manaus, AM, 3 dez. 2009. Disponível em: https://sapl.al.am.leg.br/media/sapl/public/normajuridica/2009/861/861_texto_integral.pdf`,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ESTADO DO PARÁ
  // ═══════════════════════════════════════════════════════════════════

  {
    estadoUf: "PA",
    municipio: null,
    tipo: "estadual",
    titulo: "Lei nº 5.199/1984 — Sistema de Saúde do Estado do Pará",
    referenciaAbnt: `PARÁ. Assembleia Legislativa. Lei nº 5.199, de 10 de dezembro de 1984. Dispõe sobre o Sistema de Saúde do Estado do Pará e aprova a legislação básica sobre promoção, proteção e recuperação da saúde. Diário Oficial do Estado do Pará, Belém, PA, 10 dez. 1984.`,
  },
  {
    estadoUf: "PA",
    municipio: "Marabá",
    tipo: "municipal",
    titulo: "Lei nº 17.333/2008 — Código de Posturas de Marabá (PA)",
    referenciaAbnt: `MARABÁ (PA). Câmara Municipal. Lei nº 17.333, de 30 de dezembro de 2008. Disciplina o Poder de Polícia Administrativo no âmbito do Município de Marabá, instituindo o Código de Posturas Municipais, e dá outras providências. Diário Oficial do Município, Marabá, PA, 30 dez. 2008. Disponível em: https://maraba.pa.gov.br/wp-content/uploads/2023/11/Codigo-de-Postura-de-Maraba.pdf`,
  },
];

export default legislacoes;
