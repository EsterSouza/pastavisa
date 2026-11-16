// Estrutura de planejamentos recentes da Ester, de profissões diferentes, só com
// rótulos, títulos e nomes de documentos, para a IA seguir a grafia e a ordem.
// Os documentos gerais usam um nome só (o dos planejamentos de 11 e 12/11/2026).
// Nenhum dado de cliente fica aqui.

export const ROTULOS_IDENTIFICACAO = [
  "Titular informada",
  "Razão social",
  "Nome fantasia",
  "CNPJ",
  "Inscrição municipal",
  "Endereço informado",
  "Telefone",
  "E-mail",
  "Horário de funcionamento",
  "Atividade selecionada",
  "Formação e registros declarados",
  "Responsável técnica e legal",
  "Responsável técnica",
  "Responsáveis legais",
  "Sócios administradores",
  "Áreas de atuação declaradas",
  "Equipe informada",
  "Profissionais parceiros",
  "Funcionamento atual",
];

export const ROTULOS_TERCEIRIZADOS = [
  "Coleta e destinação de resíduos de serviços de saúde",
  "Coleta de resíduos comuns",
  "Controle integrado de vetores e pragas urbanas",
  "Limpeza do reservatório de água",
  "Limpeza e manutenção do sistema de climatização",
  "Esterilização de materiais críticos",
];

export const EXEMPLOS_PLANEJAMENTOS = `
=== Planejamento de 12/11/2026 (enfermeira obstetra e esteta, profissional única, sala em edifício comercial; saúde da mulher, procedimentos de enfermagem, injetáveis, tecnologias e ozônio; materiais descartáveis) ===
I. DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA
- Relação de Serviços e Equipamentos
- Manual de Boas Práticas em Serviço de Saúde
- Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)
- Plano de Segurança do Paciente (PSP)
- Plano de Contingência
[sem Relação de Profissionais Atuantes: atende sozinha]
II. POPs - ROTINAS GERAIS DE BIOSSEGURANÇA, LIMPEZA, ESTRUTURA E CONTROLE
- POP - Higienização das Mãos
- POP - Uso de Equipamentos de Proteção Individual (EPIs)
- POP - Limpeza e Desinfecção de Superfícies e Ambientes
- POP - Limpeza e Desinfecção do Refrigerador
- POP - Limpeza e Manutenção do Sistema de Climatização
- POP - Controle Integrado de Vetores e Pragas Urbanas
- POP - Limpeza de Reservatório e Controle de Potabilidade da Água
- POP - Gerenciamento Interno de Resíduos
- POP - Prevenção e Conduta em Acidentes com Material Biológico
- POP - Recebimento, Armazenamento e Rastreabilidade de Produtos
- POP - Rastreabilidade de Injetáveis, Lotes e Insumos
- POP - Gestão e Manutenção de Equipamentos de Saúde
- POP - Gestão de Segurança em Tecnologias a Laser e LED
III. POPs - AVALIAÇÃO, REGISTRO E SEGURANÇA ASSISTENCIAL
- POP - Consulta de Enfermagem e Registro em Prontuário
- POP - Implementação do Processo de Enfermagem
- POP - Aferição e Monitoramento de Sinais Vitais
- POP - Prevenção de Oclusão Vascular e Protocolo de Reversão com Hialuronidase
- POP - Intercorrências Assistenciais e Encaminhamento de Urgência
IV. POPs - SAÚDE DA MULHER E SAÚDE REPRODUTIVA
- POP - Atendimentos e Procedimentos em Saúde da Mulher
- POP - Avaliação Funcional e Treinamento do Assoalho Pélvico [sem template: pendência]
- POP - Testes Rápidos e Diagnósticos
- POP - Coleta de Citopatológico em Meio Líquido com Teste de DNA-HPV
- POP - Inserção de Dispositivo Intrauterino (DIU)
- POP - Inserção de Implante Contraceptivo Subdérmico Implanon NXT
V. POPs - PROCEDIMENTOS ASSISTENCIAIS DE ENFERMAGEM
- POP - Retirada de Pontos Cirúrgicos
- POP - Curativo e Cuidados com Feridas
- POP - Administração de Medicamentos por Via Subcutânea, Intramuscular e Endovenosa
- POP - Punção, Manutenção e Retirada de Acesso Venoso Periférico
- POP - Terapia Intravenosa com Vitaminas, Minerais e Aminoácidos [no lugar de "ortomolecular"]
- POP - Prevenção e Tratamento de Intercorrências Venosas
VI. POPs - PROCEDIMENTOS ESTÉTICOS INJETÁVEIS
- POP - Toxina Botulínica Tipo A
- POP - Preenchimento Dérmico com Ácido Hialurônico
- POP - Bioestimuladores de Colágeno Facial e Corporal
- POP - Harmonização Íntima Feminina
- POP - Inserção de Fios Absorvíveis de Polidioxanona (PDO)
- POP - Mesoterapia e Intradermoterapia
- POP - Intradermoterapia Capilar (Mesoterapia Capilar)
VII. POPs - TECNOLOGIAS ESTÉTICAS, FOTOBIOMODULAÇÃO E OZONIOTERAPIA
- POP - Microagulhamento e Drug Delivery
- POP - Radiofrequência Microagulhada
- POP - Ultrassom Microfocado e Macrofocado
- POP - HIFU Íntimo / Ultrassom Micro e Macrofocado Íntimo [template exclui intravaginal e pequenos lábios: pendência]
- POP - Radiofrequência
- POP - Fotobiomodulação
- POP - Irradiação Intravascular do Sangue com Laser (ILIB) [sem template: pendência]
- POP - Terapia Fotodinâmica Antimicrobiana (aPDT) [sem template: pendência]
- POP - Laser CO₂ e Laser CO₂ Fracionado
- POP - Luz Intensa Pulsada [sem template: pendência]
- POP - Corrente Aussie e Corrente Russa - Fortalecimento Muscular
- POP - Jato de Plasma
- POP - Alta Frequência
- POP - Ozonioterapia [só as vias da NT Anvisa 41/2026; as vias declaradas fora dela viram pendência]
VIII. POPs - PROCEDIMENTOS ESTÉTICOS MANUAIS E EPIDÉRMICOS
- POP - Clareamento Íntimo
- POP - Aplicação de Peelings Químicos
- POP - Limpeza de Pele com Vapor de Ozônio, Oxigenoterapia, Alta Frequência e LED [recursos que ela declarou]
- POP - Massagem Terapêutica, Relaxante e Redutora
- POP - Drenagem Linfática
- POP - Taping Pós-Cirúrgico (Bandagem Elástica)
IX. FICHAS DE ANAMNESE E AVALIAÇÃO
- Ficha de Cadastro, Anamnese e Avaliação Estética
- Ficha de Anamnese e Avaliação para Procedimentos Estéticos Injetáveis
- Ficha de Anamnese - Saúde da Mulher
- Ficha de Anamnese e Avaliação de Terapias Injetáveis e Soroterapia
- Ficha de Avaliação e Evolução de Feridas
- Ficha de Perimetria e Evolução Corporal
- Folha de Evolução Facial
- Folha de Evolução Corporal
[8 fichas: saíram a de monitoramento da terapia infusional e a de ozonioterapia, cobertas por outras]
X. TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO E TERMOS CORRELATOS
- TCLE - Consulta de Enfermagem em Saúde da Mulher e Saúde Reprodutiva
- TCLE - Coleta de Citopatológico em Meio Líquido com Teste de DNA-HPV
- TCLE - Inserção de Dispositivo Intrauterino (DIU)
- TCLE - Inserção de Implante Contraceptivo Subdérmico Implanon NXT
- TCLE - Curativo e Cuidados com Feridas
- TCLE - Terapia Injetável e Administração de Medicamentos
- TCLE - Aplicação de Toxina Botulínica
- TCLE - Preenchimento Dérmico com Ácido Hialurônico
- TCLE - Bioestimuladores de Colágeno
- TCLE - Fios de Sustentação de PDO
- TCLE - Mesoterapia e Intradermoterapia Facial e Corporal
- TCLE - Mesoterapia e Intradermoterapia Capilar
- TCLE - Microagulhamento e Drug Delivery
- TCLE - Radiofrequência Microagulhada
- TCLE - HIFU, Ultrassom Macro e Microfocado
- TCLE - Radiofrequência
- TCLE - Fotobiomodulação e Laserterapia
- TCLE - Laser CO₂ e Laser CO₂ Fracionado
- TCLE - Fototerapia com LED e Luz Intensa Pulsada (LIP)
- TCLE - Corrente Russa e Eletroestimulação
- TCLE - Jato de Plasma
- TCLE - Alta Frequência
- TCLE - Ozonioterapia
- TCLE - Clareamento Íntimo
- TCLE - Peelings Químicos
- TCLE - Limpeza de Pele
- TCLE - Massoterapia, Massagem Terapêutica, Relaxante e Redutora
- TCLE - Drenagem Linfática
- TCLE - Taping Pós-Cirúrgico
- Termo de Autorização para Uso de Imagem e Registro Fotográfico
- Termo de Recusa ou Interrupção de Tratamento
XI. PLANILHAS, FORMULÁRIOS E REGISTROS DE CONTROLE
- Planilha de Rastreabilidade de Injetáveis, Produtos, Insumos e Lotes
- Planilha de Controle de Limpeza Concorrente e Terminal
- Planilha de Controle de Temperatura do Refrigerador
- Registro de Manutenção, Calibração e Segurança Elétrica dos Equipamentos
- Checklist de Recursos para Atendimento Inicial de Emergências
- Formulário de Intercorrências e Eventos Adversos
- Formulário de Encaminhamento Profissional
- Receituário de Orientações Pós-Procedimento
- Controle de Entrega de Orientações Pós-Procedimentos
- Guia de Utilização da Pasta Sanitária

=== Planejamento de 17/10/2026, revisado em 11/11/2026 (biomédica, profissional única, sala em edifício comercial; injetáveis e tecnologias; materiais descartáveis) ===
I. DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA
- Relação de Serviços e Equipamentos
- Manual de Boas Práticas em Serviço de Saúde
- Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)
- Plano de Segurança do Paciente (PSP)
- Plano de Contingência
II. POPs - ROTINAS GERAIS DE BIOSSEGURANÇA, LIMPEZA, ESTRUTURA E CONTROLE
- POP - Higienização das Mãos
- POP - Uso de Equipamentos de Proteção Individual (EPIs)
- POP - Limpeza e Desinfecção de Superfícies e Ambientes
- POP - Limpeza e Desinfecção do Refrigerador [toxina exige 2 a 8 °C, mesmo sem refrigerador no formulário]
- POP - Limpeza e Manutenção do Sistema de Climatização
- POP - Controle Integrado de Vetores e Pragas Urbanas
- POP - Limpeza de Reservatório e Controle de Potabilidade da Água
- POP - Gerenciamento Interno de Resíduos
- POP - Prevenção e Conduta em Acidentes com Material Biológico
- POP - Recebimento, Armazenamento e Rastreabilidade de Produtos
- POP - Rastreabilidade de Injetáveis, Lotes e Insumos
- POP - Gestão e Manutenção de Equipamentos de Saúde
- POP - Gestão de Segurança em Tecnologias a Laser e LED
III. POPs - AVALIAÇÃO, REGISTRO E SEGURANÇA ASSISTENCIAL
- POP - Consulta em Saúde Estética e Registro em Prontuário
- POP - Prevenção de Oclusão Vascular e Protocolo de Reversão com Hialuronidase
- POP - Intercorrências Assistenciais e Encaminhamento de Urgência
IV. POPs - PROCEDIMENTOS ESTÉTICOS E TECNOLOGIAS
- POP - Aplicação de Peelings Químicos
- POP - Microagulhamento e Drug Delivery
- POP - Laser de Túlio 1927 nm (Lavieen)
- POP - Ultrassom Microfocado e Macrofocado
- POP - Ultrassom (Terapêutico e Estético)
- POP - Criolipólise
- POP - Depilação a Laser [aparelho com registro cancelado: o procedimento fica, sem marca, e a cliente é avisada]
V. POPs - PROCEDIMENTOS ESTÉTICOS INJETÁVEIS
- POP - Toxina Botulínica Tipo A [hiperidrose fora: biomédica]
- POP - Preenchimento Dérmico Facial com Ácido Hialurônico
- POP - Bioestimuladores de Colágeno Facial e Corporal
- POP - Harmonização Corporal e Glútea
- POP - Lipo Enzimática de Gordura Localizada e Glúteos
- POP - Lipo Enzimática de Papada [sem desoxicolato: CFBM 299/2018]
- POP - Procedimento Estético Injetável em Microvasos (PEIM)
VI. FICHAS DE ANAMNESE E AVALIAÇÃO
- Ficha de Anamnese e Avaliação para Procedimentos Estéticos Injetáveis
- Ficha de Cadastro, Anamnese e Avaliação Estética
- Ficha de Perimetria e Evolução Corporal
- Folha de Evolução Facial
- Folha de Evolução Corporal
VII. TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO E TERMOS CORRELATOS
- TCLE - Aplicação de Toxina Botulínica
- TCLE - Preenchimento Dérmico Facial com Ácido Hialurônico
- TCLE - Bioestimuladores de Colágeno
- TCLE - Harmonização de Glúteos
- TCLE - Lipo Enzimática
- TCLE - Lipo Enzimática de Papada
- TCLE - PEIM (Escleroterapia)
- TCLE - Peelings Químicos
- TCLE - Microagulhamento e Drug Delivery
- TCLE - Laser Lavieen (Laser de Túlio 1927 nm)
- TCLE - HIFU (Ultrassom Macro e Microfocado)
- TCLE - Ultrassom Estético
- TCLE - Criolipólise
- TCLE - Depilação a Laser
- Termo de Autorização para Uso de Imagem e Registro Fotográfico
- Termo de Recusa ou Interrupção de Tratamento
VIII. PLANILHAS, FORMULÁRIOS E REGISTROS DE CONTROLE
- Planilha de Rastreabilidade de Injetáveis, Produtos, Insumos e Lotes
- Planilha de Controle de Limpeza Concorrente e Terminal
- Planilha de Controle de Temperatura do Refrigerador
- Registro de Manutenção, Calibração e Segurança Elétrica dos Equipamentos
- Checklist de Recursos para Atendimento Inicial de Emergências
- Formulário de Intercorrências e Eventos Adversos
- Formulário de Encaminhamento Profissional
- Receituário de Orientações Pós-Procedimento
- Controle de Entrega de Orientações Pós-Procedimentos
- Guia de Utilização da Pasta Sanitária

=== Planejamento de 13/10/2026 (médico angiologista e enfermeira, núcleo de feridas; laser, ozônio em feridas, PRF e escleroterapia feita pelo médico; autoclave própria) ===
I. DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA
- Relação de Serviços e Equipamentos
- Relação de Profissionais Atuantes [duas profissionais]
- Manual de Boas Práticas em Serviço de Saúde
- Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)
- Plano de Segurança do Paciente (PSP)
- Plano de Contingência
II. POPs - ROTINAS GERAIS DE BIOSSEGURANÇA, LIMPEZA, ESTRUTURA E CONTROLE
- POP - Higienização das Mãos
- POP - Uso de Equipamentos de Proteção Individual (EPIs)
- POP - Limpeza e Desinfecção de Superfícies e Ambientes
- POP - Limpeza e Manutenção do Sistema de Climatização
- POP - Controle Integrado de Vetores e Pragas Urbanas
- POP - Limpeza de Reservatório e Controle de Potabilidade da Água
- POP - Gerenciamento Interno de Resíduos
- POP - Prevenção e Conduta em Acidentes com Material Biológico
- POP - Recebimento, Armazenamento e Rastreabilidade de Produtos
- POP - Processamento de Materiais (Limpeza, Desinfecção e Esterilização) [autoclave própria confirmada]
- POP - Validação e Monitoramento do Processo de Esterilização
- POP - Gestão e Manutenção de Equipamentos de Saúde
- POP - Gestão de Segurança em Tecnologias a Laser e LED
III. POPs - AVALIAÇÃO, REGISTRO E SEGURANÇA ASSISTENCIAL
- POP - Gestão do Prontuário, Identificação do Paciente e Registros Assistenciais Multiprofissionais [médico e enfermeira]
- POP - Consulta de Enfermagem e Registro em Prontuário
- POP - Implementação do Processo de Enfermagem
- POP - Aferição e Monitoramento de Sinais Vitais
- POP - Controle da Glicemia
- POP - Intercorrências Assistenciais e Encaminhamento de Urgência
IV. POPs - TRATAMENTO DE FERIDAS E PROCEDIMENTOS ASSISTENCIAIS
- POP - Curativo e Cuidados com Feridas
- POP - Laserterapia em Afecções Clínicas e Estéticas
- POP - Ozonioterapia [bolsa em feridas]
- POP - Coleta e Processamento de Hemoderivados (PRP e PRF)
- POP - Procedimento Estético Injetável em Microvasos (PEIM)
V. FICHAS DE ANAMNESE E AVALIAÇÃO
- Ficha de Avaliação e Evolução de Feridas
- Ficha de Atendimento e Evolução em Ozonioterapia
VI. TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO E TERMOS CORRELATOS
- TCLE - Curativo e Cuidados com Feridas
- TCLE - Fotobiomodulação e Laserterapia
- TCLE - Ozonioterapia
- TCLE - Coleta e Aplicação de Hemoderivados (PRP e PRF)
- TCLE - PEIM (Escleroterapia)
- Termo de Autorização para Uso de Imagem e Registro Fotográfico
- Termo de Recusa ou Interrupção de Tratamento
VII. PLANILHAS, FORMULÁRIOS E REGISTROS DE CONTROLE
- Planilha de Rastreabilidade de Insumos, Produtos, Medicamentos e Lotes
- Planilha de Controle de Limpeza Concorrente e Terminal
- Registro do Processo de Esterilização
- Registro de Manutenção, Calibração e Segurança Elétrica dos Equipamentos
- Checklist de Recursos para Atendimento Inicial de Emergências
- Formulário de Intercorrências e Eventos Adversos
- Formulário de Encaminhamento Profissional
- Receituário de Orientações Pós-Procedimento
- Controle de Entrega de Orientações Pós-Procedimentos
- Guia de Utilização da Pasta Sanitária

=== Planejamento de 23/09/2026 (fisioterapeuta dermatofuncional e tricologia, com profissionais parceiras no espaço; toalhas lavadas no local) ===
I. DOCUMENTOS INSTITUCIONAIS, GERENCIAIS E DE SEGURANÇA
- Relação de Serviços e Equipamentos
- Relação de Profissionais Atuantes
- Manual de Boas Práticas em Serviço de Saúde
- Plano de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS)
- Plano de Segurança do Paciente (PSP)
- Plano de Contingência
- Regulamento Interno para Profissionais Parceiros e Uso Compartilhado do Espaço [há parceiras]
II. POPs - ROTINAS GERAIS DE BIOSSEGURANÇA, LIMPEZA, ESTRUTURA E CONTROLE
- POP - Higienização das Mãos
- POP - Uso de Equipamentos de Proteção Individual (EPIs)
- POP - Limpeza e Desinfecção de Superfícies e Ambientes
- POP - Limpeza e Desinfecção de Escovas, Pentes e Prendedores [terapia capilar]
- POP - Limpeza e Desinfecção dos Instrumentos de Liberação Miofascial [instrumentos reutilizáveis]
- POP - Processamento de Toalhas [lavadas no local]
- POP - Limpeza e Manutenção do Sistema de Climatização
- POP - Controle Integrado de Vetores e Pragas Urbanas
- POP - Limpeza de Reservatório e Controle de Potabilidade da Água
- POP - Gerenciamento Interno de Resíduos
- POP - Prevenção e Conduta em Acidentes com Material Biológico
- POP - Recebimento, Armazenamento e Rastreabilidade de Produtos
- POP - Rastreabilidade de Injetáveis, Lotes e Insumos
- POP - Gestão e Manutenção de Equipamentos de Saúde
- POP - Gestão de Segurança em Tecnologias a Laser e LED
III. POPs - AVALIAÇÃO, REGISTRO E SEGURANÇA ASSISTENCIAL
- POP - Avaliação Fisioterapêutica Dermatofuncional
- POP - Intercorrências Assistenciais e Encaminhamento de Urgência
IV. POPs - PROCEDIMENTOS FACIAIS, CORPORAIS E CAPILARES
- POP - Limpeza de Pele com Recursos Eletroterapêuticos
- POP - Peelings Químicos
- POP - Peeling Ultrassônico
- POP - Microagulhamento e Drug Delivery
- POP - Mesoterapia e Intradermoterapia
- POP - Intradermoterapia Capilar
- POP - Intradermoterapia Pressurizada
- POP - Radiofrequência
- POP - Ultrassom
- POP - Cavitação Lipo sem Corte
- POP - Ondas de Choque
- POP - Fotobiomodulação
- POP - Laserterapia e LEDterapia com Máscara
- POP - Alta Frequência
- POP - Terapia Capilar, Alopecia e Calvície
V. POPs - RECURSOS TERAPÊUTICOS MANUAIS, ELETROTERAPIA E REABILITAÇÃO
- POP - TENS
- POP - Eletroestimulação Neuromuscular
- POP - Drenagem Linfática
- POP - Massoterapia, Massagem Terapêutica, Relaxante e Redutora
- POP - Liberação Miofascial Instrumental
- POP - Taping Pós-Cirúrgico
VI. FICHAS DE ANAMNESE E AVALIAÇÃO
- Ficha de Cadastro, Anamnese e Avaliação Estética
- Ficha de Avaliação Corporal e Pós-Operatório
- Ficha de Perimetria e Evolução Corporal
- Ficha de Avaliação e Evolução Capilar e do Couro Cabeludo
- Folha de Evolução Facial
- Folha de Evolução Corporal
VII. TERMOS DE CONSENTIMENTO LIVRE E ESCLARECIDO E TERMOS CORRELATOS
- TCLE - Limpeza de Pele
- TCLE - Peelings Químicos
- TCLE - Peeling Ultrassônico
- TCLE - Microagulhamento e Drug Delivery
- TCLE - Mesoterapia e Intradermoterapia Facial e Corporal
- TCLE - Mesoterapia e Intradermoterapia Capilar
- TCLE - Radiofrequência
- TCLE - Ultrassom Estético
- TCLE - Cavitação Lipo sem Corte
- TCLE - Ondas de Choque
- TCLE - Fotobiomodulação e Laserterapia
- TCLE - Alta Frequência
- TCLE - Terapia Capilar, Alopecia e Calvície
- TCLE - TENS
- TCLE - Corrente Russa e Eletroestimulação
- TCLE - Drenagem Linfática e Pós-Operatório Estético
- TCLE - Massoterapia, Massagem Terapêutica, Relaxante e Redutora
- TCLE - Liberação Miofascial Instrumental
- TCLE - Taping Pós-Cirúrgico
- Termo de Autorização para Uso de Imagem e Registro Fotográfico
- Termo de Recusa ou Interrupção de Tratamento
VIII. PLANILHAS, FORMULÁRIOS E REGISTROS DE CONTROLE
- Planilha de Rastreabilidade de Injetáveis, Produtos, Insumos e Lotes
- Planilha de Controle de Limpeza Concorrente e Terminal
- Planilha de Controle de Temperatura do Refrigerador
- Formulário de Intercorrências e Eventos Adversos
- Formulário de Encaminhamento Profissional
- Receituário de Orientações Pós-Procedimento
- Controle de Entrega de Orientações Pós-Procedimentos
- Guia de Utilização da Pasta Sanitária
`;
