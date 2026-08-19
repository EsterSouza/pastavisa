/**
 * Vocabulário comercial das clínicas.
 *
 * O cliente raramente escreve o nome técnico do procedimento: escreve o apelido do
 * dia a dia, a marca registrada que virou nome popular, a sigla, o nome do aparelho
 * ou o nome do protocolo da própria casa. Sem esse vocabulário, "botox" é lido como
 * marca e o procedimento mais comum da estética some do planejamento.
 *
 * A lista sai de quatro fontes: o acervo de documentos da equipe, os "Documentos em
 * elaboração" de clientes reais — que mostram como elas de fato escrevem —, a
 * conferência do vocabulário corrente do setor e a pesquisa do que clínicas, salões
 * e fabricantes publicam como nome de serviço e de aparelho.
 *
 * A regra é estreita: o vocabulário resolve **como nomear** um termo que está no
 * texto. Ele nunca acrescenta procedimento que o cliente não declarou.
 */

/** Termo popular sem ambiguidade → nome técnico que a equipe usa. */
export const POPULAR_TERMS: ReadonlyArray<readonly [string, string]> = [
  // Injetáveis e harmonização. Marca de toxina e de preenchedor entra aqui porque o
  // cliente escreve a marca no lugar da técnica: "aplico Dysport" é toxina declarada.
  [
    "botox, toxina, tox, botulínica, full face, microtox, mesotox, Dysport, Xeomin, Prosigne, Botulift, Nabota, Letybo, Botulim",
    "Toxina Botulínica",
  ],
  [
    "preenchimento, preencher, AH, ácido hialurônico injetado, filler, Juvederm, Restylane, Belotero, Teosyal, Rennova",
    "Preenchimento Dérmico com Ácido Hialurônico",
  ],
  [
    "bio, bio de colágeno, bioestimulador, Sculptra, Radiesse, Elleva, Ellansé, Hialurox, ácido poli-L-lático, PLLA, hidroxiapatita de cálcio, policaprolactona",
    "Bioestimuladores de Colágeno",
  ],
  ["biorremodelador, Profhilo, HarmonyCa, Sunekos, Nithya", "Biorremodeladores Teciduais"],
  ["skin, skinbooster, hidratação injetável, hidra injetável, Restylane Vital", "Skinbooster"],
  ["harmo, HOF, harmonização facial global, harmonização orofacial", "Harmonização Facial"],
  ["fios, PDO, fio de sustentação, fio liso, fio espiculado, fio mono, lifting com fios", "Fios de PDO"],
  [
    "PEIM, secagem de vasinhos, escleroterapia, vasinho, esclerose de vasinhos, aplicação de glicose",
    "PEIM (Procedimento Estético Injetável em Microvasos)",
  ],
  [
    "lipo enzimática, lipo sem corte, enzima, enzimas, lipo de papada, deoxicolato, ácido deoxicólico",
    "Intradermoterapia com Enzimas",
  ],
  ["intradermo, meso, mesoterapia, intradermoterapia pressurizada, pressurizada", "Intradermoterapia e Mesoterapia"],
  ["subcisão, subcision", "Subcisão de Celulite"],
  ["PRP, plasma rico em plaquetas, PRF, plasma gel", "Plasma Rico em Plaquetas (PRP)"],
  [
    "PDRN, exossomo, exossomos, regenerador celular, salmão, Rejuran, Nucleofill, polinucleotídeos",
    "Terapias Regenerativas com PDRN e Exossomos",
  ],
  [
    "soroterapia, ortomolecular, IV, endovenosa, vitamina na veia, coquetel injetável",
    "Terapia Ortomolecular e Suplementação Intravenosa",
  ],
  ["rino, rinomodelação, nariz sem cirurgia", "Rinomodelação"],
  ["carboxi, carboxiterapia", "Carboxiterapia"],
  ["ozônio, ozonioterapia", "Ozonioterapia"],
  ["PMMA, bioplastia, metacrilato", "Bioplastia com PMMA"],
  [
    "caneta emagrecedora, Ozempic, Mounjaro, Saxenda, semaglutida, tirzepatida, liraglutida",
    "Terapia Injetável para Controle de Peso",
  ],

  // Pele e face não injetável.
  ["LP, limpeza, limpeza de pele profunda, extração, extração de cravos, higienização facial", "Limpeza de Pele"],
  [
    "MMP, indução percutânea de colágeno, drug delivery, dermapen, dr pen, microagulhamento, microinfusão",
    "Microagulhamento e Drug Delivery",
  ],
  ["ATA, TCA, peeling de ácido, peeling de fenol, retinol, mandélico", "Peeling Químico"],
  ["peeling de cristal, peeling de diamante, microdermoabrasão", "Peeling Físico"],
  ["hidrodermoabrasão, HydraFacial, hydra peel, peeling de hidratação a vácuo", "Hidrodermoabrasão"],
  ["peeling de carbono, carbon peel, laser peel, peeling de carvão", "Peeling de Carbono a Laser"],
  ["dermaplaning, dermaplanning", "Dermaplaning"],
  ["alta frequência, AF", "Alta Frequência"],
  ["microcorrentes, microgalvânica", "Microcorrentes"],
  ["eletrolifting, dermolifting", "Eletrolifting"],
  ["jato de plasma, plasma jet, blefaro sem corte, blefaroplastia sem corte", "Jato de Plasma"],
  ["BB glow, pele de porcelana", "BB Glow"],
  ["lip glow, hydra gloss, gloss labial, labial hidratado, BB lips", "Lip Glow"],
  [
    "micropigmentação, micro labial, dermógrafo, nanopigmentação, microblading, nanoblading, shadow, soft shadow, tebori, dermopigmentação",
    "Micropigmentação",
  ],
  ["micropigmentação capilar, tricopigmentação", "Micropigmentação Capilar"],

  // Tecnologias. O aparelho de função única entra como técnica: quem escreve
  // "Ultraformer" está declarando ultrassom microfocado. O multifunção fica em
  // EQUIPMENT_TERMS, para ser perguntado em vez de adivinhado.
  ["RF, radio, radiofrequência fracionada, radiofrequência microagulhada", "Radiofrequência"],
  [
    "US, HIFU, micro e macrofocado, Ultraformer, Ultherapy, Sofwave, Sonofocus, ultrassom focalizado, lifting sem corte",
    "Ultrassom Microfocado e Macrofocado",
  ],
  ["cavitação, ultracavitação, lipo cavitação", "Cavitação Ultrassônica"],
  ["crio, criolipólise, criofrequência, criotecar, CoolSculpting, Crioslim", "Criolipólise"],
  ["LED, ledterapia, fotobio, fotobiomodulação, ILIB, máscara de LED", "Fotobiomodulação e LEDterapia"],
  ["IPL, luz intensa pulsada", "Luz Intensa Pulsada"],
  [
    "epilação, depilação definitiva, depilação a laser, fotodepilação, laser de diodo, alexandrite, Soprano, Lightsheer, triple wave",
    "Depilação a Laser",
  ],
  ["CO2, laser de CO2, laser fracionado, túlio, érbio, Lavieen", "Laser Ablativo e Fracionado"],
  [
    "Q-switched, remoção de tatuagem, despigmentação, remoção de micropigmentação, Spectra",
    "Remoção de Pigmentação Estética",
  ],
  ["endermo, endermoterapia, vacuoterapia, vácuo, dermotonus, endermologia, LPG", "Endermoterapia e Vacuoterapia"],
  ["eletroestimulação, corrente russa, corrente aussie, ezbody, tensor, EMS, EMSculpt", "Eletroestimulação Muscular"],
  ["ondas de choque, shockwave", "Ondas de Choque"],
  ["pressoterapia, bota compressiva", "Pressoterapia"],
  ["manta térmica, plataforma vibratória, vibro-oscilatória, modellata", "Terapias Corporais com Equipamento"],
  ["hidrolipoclasia, hidrolipo", "Hidrolipoclasia Não Aspirativa"],

  // Manuais e integrativas.
  ["drenagem, DLM, drenagem linfática manual", "Drenagem Linfática"],
  ["modeladora, massagem modeladora, redutora", "Massagem Modeladora"],
  ["relaxante, massagem terapêutica, quick massage, massagem expressa", "Massagem Terapêutica"],
  ["pedras quentes, massagem com pedras", "Massagem com Pedras Quentes"],
  ["escalda-pés, reflexologia, reflexologia podal", "Reflexologia Podal"],
  ["ventosa, ventosaterapia, liberação miofascial", "Liberação Miofascial com Ventosa"],
  ["taping, bandagem elástica, kinesio, kinesiotaping", "Bandagem Elástica Funcional"],
  ["argila, argiloterapia, esfoliação corporal, hidratação corporal", "Argiloterapia e Esfoliação Corporal"],
  ["auriculo, auriculoterapia, cone hindu, acupuntura auricular", "Auriculoterapia"],
  ["aroma, aromaterapia", "Aromaterapia"],

  // Auricular, piercing e íntimo.
  ["furo de orelha, perfuração, furo humanizado, brinco", "Perfuração Auricular"],
  ["piercing, body piercing", "Body Piercing"],
  ["lobuloplastia, lobulomodelação, fechamento de lóbulo", "Revitalização e Fechamento de Lóbulo Auricular"],
  ["otomodelação, orelha de elfo", "Otomodelação Não Cirúrgica"],
  ["clareamento íntimo, clareamento de virilha, clareamento de axila", "Clareamento Íntimo"],
  ["rejuvenescimento íntimo, íntima externa", "Rejuvenescimento Íntimo Externo"],

  // Beleza, pelos e cuidados pessoais.
  ["depilação com cera, cera quente, cera fria, depilação egípcia, depilação com linha", "Depilação com Cera"],
  ["banho de lua, clareamento de pelos, descoloração de pelos", "Banho de Lua"],
  ["bronzeamento a jato, jet bronze, spray tanning, autobronzeador", "Bronzeamento por Pigmentação Tópica"],
  ["design, design de sobrancelha, henna", "Design de Sobrancelhas"],
  ["brow lamination, laminação de sobrancelhas", "Laminação de Sobrancelhas"],
  ["cílios, extensão de cílios, volume russo, lash", "Extensão de Cílios"],
  ["lash lifting, curvatura de cílios, lash botox, botox de cílios", "Lash Lifting"],
  ["manicure, pedicure, esmaltação, esmaltação em gel, spa dos pés", "Manicure e Pedicure"],
  ["alongamento de unhas, fibra de vidro, unha de gel, molde F1, postiça", "Alongamento de Unhas"],
  ["progressiva, escova progressiva, alisamento capilar, selagem, realinhamento capilar", "Alisamento Capilar"],
  ["coloração, tintura, mechas, luzes, descoloração capilar", "Coloração Capilar"],
  ["botox capilar, botox de cabelo, reconstrução capilar, cauterização capilar", "Tratamento Capilar de Reconstrução"],

  // Capilar clínico, corporal e outros.
  ["capilar injetável, mesoterapia capilar, terapia capilar", "Intradermoterapia Capilar"],
  ["tricologia, avaliação capilar, tricoscopia", "Avaliação Tricológica"],
  ["estrias, tratamento de estrias", "Tratamento de Estrias"],
  ["cicatriz de acne, cicatrizes", "Tratamento de Cicatrizes de Acne"],
  ["melasma, clareamento de manchas, melanose", "Clareamento de Melasma, Melanose e Manchas Senis"],
  ["glúteo, pump up, harmonização glútea, levanta bumbum", "Harmonização Corporal Glútea"],
  ["podologia, pé diabético, onicomicose, unha encravada, ortonixia, calosidade", "Podologia"],
];

/**
 * Termo que tem mais de um significado real na estética. Aqui a análise não escolhe:
 * devolve menção `uncertain` para o comercial confirmar com o cliente.
 *
 * Nenhum destes pode aparecer também como apelido em POPULAR_TERMS — seria instrução
 * contraditória, e o teste do vocabulário barra isso.
 */
export const AMBIGUOUS_TERMS: ReadonlyArray<readonly [string, string]> = [
  ["micro", "microagulhamento ou micropigmentação"],
  ["plasma", "PRP, plasma gel autólogo ou jato de plasma"],
  ["peeling", "químico, enzimático, físico ou de cristal e diamante"],
  ["laser", "depilação, remoção de pigmento, CO2, túlio ou baixa potência"],
  ["luz", "luz intensa pulsada ou LED"],
  ["lipo", "intradermoterapia com enzimas, criolipólise, cavitação ou hidrolipoclasia"],
  ["capilar", "intradermoterapia capilar, microagulhamento capilar ou LED capilar"],
  ["íntimo", "clareamento, peeling, radiofrequência ou rejuvenescimento íntimo externo"],
  ["ultrassom", "estético de baixa intensidade, cavitação ou micro e macrofocado"],
  ["massagem", "modeladora, relaxante, drenagem linfática ou liberação miofascial"],
  ["detox", "protocolo próprio da casa — confirmar quais técnicas o compõem"],
  ["harmonização", "facial, glútea ou corporal — confirmar a região"],
  ["glow", "BB Glow, Lip Glow ou nome de protocolo próprio da casa"],
  ["hidra", "hidratação facial com cosmético, hidrodermoabrasão ou skinbooster injetável"],
  ["fio a fio", "micropigmentação de sobrancelhas ou extensão de cílios"],
  ["clareamento", "de manchas faciais, de pelos ou íntimo"],
  ["bronzeamento", "por pigmentação tópica ou em câmara de bronzeamento"],
  ["spa", "protocolo próprio da casa — confirmar quais técnicas o compõem"],
];

/**
 * Aparelho multifunção e nome de fabricante.
 *
 * Aparelho não é procedimento. O de função única já está em POPULAR_TERMS, porque
 * quem escreve "Ultraformer" está declarando ultrassom microfocado. Estes aqui não
 * dizem qual técnica é feita — dizem só o que o aparelho é capaz de fazer —, então
 * viram pergunta ao cliente em vez de palpite.
 */
export const EQUIPMENT_TERMS: ReadonlyArray<readonly [string, string]> = [
  ["Heccus, Manthus", "aparelho que combina ultrassom e eletroestimulação"],
  ["Acrus, Hooke, Artis", "plataforma multifunção de estética facial e corporal"],
  ["Etherea, Fotona, Harmony, Vzet, Scizer, Endymed, Endolaser, Endolift", "plataforma multifunção de laser"],
  ["Ibramed, HTM, Tonederm, Medical San, Bioset, KLD, Vydence, Lutronic", "fabricante de equipamento"],
];

function lista(pares: ReadonlyArray<readonly [string, string]>, seta: string): string {
  return pares.map(([termo, alvo]) => `- ${termo} ${seta} ${alvo}`).join("\n");
}

export function popularTermsBlock(): string {
  return lista(POPULAR_TERMS, "→");
}

export function ambiguousTermsBlock(): string {
  return lista(AMBIGUOUS_TERMS, "pode ser");
}

export function equipmentTermsBlock(): string {
  return lista(EQUIPMENT_TERMS, "é");
}
