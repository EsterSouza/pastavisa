/**
 * Vocabulário comercial das clínicas.
 *
 * O cliente raramente escreve o nome técnico do procedimento: escreve o apelido do
 * dia a dia, a marca registrada que virou nome popular, a sigla, ou o nome do
 * protocolo da própria casa. Sem esse vocabulário, "botox" é lido como marca e o
 * procedimento mais comum da estética some do planejamento.
 *
 * A lista sai de três fontes: o acervo de documentos da equipe, os "Documentos em
 * elaboração" de clientes reais — que mostram como elas de fato escrevem — e a
 * conferência do vocabulário corrente do setor.
 *
 * A regra é estreita: o vocabulário resolve **como nomear** um termo que está no
 * texto. Ele nunca acrescenta procedimento que o cliente não declarou.
 */

/** Termo popular sem ambiguidade → nome técnico que a equipe usa. */
export const POPULAR_TERMS: ReadonlyArray<readonly [string, string]> = [
  // Injetáveis e harmonização.
  ["botox, toxina, tox, botulínica, full face, microtox", "Toxina Botulínica"],
  ["preenchimento, preencher, AH, ácido hialurônico injetado, filler", "Preenchimento Dérmico com Ácido Hialurônico"],
  ["bio, bio de colágeno, bioestimulador, Sculptra, Radiesse, Elleva, Ellansé, Hialurox", "Bioestimuladores de Colágeno"],
  ["biorremodelador, Profhilo, HarmonyCa", "Biorremodeladores Teciduais"],
  ["skin, skinbooster, hidratação injetável, hidra injetável", "Skinbooster"],
  ["harmo, HOF, harmonização, harmonização facial global", "Harmonização Facial"],
  ["fios, PDO, fio de sustentação, fio liso, fio espiculado", "Fios de PDO"],
  ["PEIM, secagem de vasinhos, escleroterapia, vasinho", "PEIM (Procedimento Estético Injetável em Microvasos)"],
  ["lipo enzimática, lipo sem corte, enzima, enzimas, lipo de papada, lipo de enzimas", "Intradermoterapia com Enzimas"],
  ["intradermo, meso, mesoterapia, intradermoterapia pressurizada, pressurizada", "Intradermoterapia e Mesoterapia"],
  ["subcisão, subcision", "Subcisão de Celulite"],
  ["PRP, plasma rico em plaquetas, PRF, plasma gel", "Plasma Rico em Plaquetas (PRP)"],
  ["PDRN, exossomo, exossomos, regenerador celular, salmão", "Terapias Regenerativas com PDRN e Exossomos"],
  ["soroterapia, ortomolecular, IV, endovenosa, vitamina na veia, coquetel injetável", "Terapia Ortomolecular e Suplementação Intravenosa"],
  ["rino, rinomodelação", "Rinomodelação"],
  ["carboxi, carboxiterapia", "Carboxiterapia"],
  ["ozônio, ozonioterapia", "Ozonioterapia"],

  // Pele e face não injetável.
  ["LP, limpeza, limpeza de pele profunda, extração", "Limpeza de Pele"],
  ["MMP, indução percutânea de colágeno, drug delivery, dermapen, microagulhamento", "Microagulhamento e Drug Delivery"],
  ["ATA, TCA, peeling de ácido, peeling de fenol, retinol, mandélico", "Peeling Químico"],
  ["peeling de cristal, peeling de diamante, microdermoabrasão", "Peeling Físico"],
  ["dermaplaning, dermaplanning", "Dermaplaning"],
  ["alta frequência, AF", "Alta Frequência"],
  ["jato de plasma, plasma jet, blefaro sem corte, blefaroplastia sem corte", "Jato de Plasma"],
  ["BB glow, glow, pele de porcelana", "BB Glow"],
  ["lip glow, hydra gloss, gloss labial, labial hidratado", "Lip Glow"],
  ["micropigmentação, micro labial, dermografo, nanopigmentação", "Micropigmentação"],

  // Tecnologias.
  ["RF, radio, radiofrequência fracionada", "Radiofrequência"],
  ["US, HIFU, micro e macrofocado, ultraformer, ultrassom focalizado, lifting sem corte", "Ultrassom Microfocado e Macrofocado"],
  ["cavitação, ultracavitação, lipo cavitação", "Cavitação Ultrassônica"],
  ["crio, criolipólise, criofrequência, criotecar", "Criolipólise"],
  ["LED, ledterapia, fotobio, fotobiomodulação, ILIB, máscara de LED", "Fotobiomodulação e LEDterapia"],
  ["IPL, luz intensa pulsada", "Luz Intensa Pulsada"],
  ["epilação, depilação definitiva, depilação a laser, triple wave", "Depilação a Laser"],
  ["CO2, laser de CO2, laser fracionado, tulio, Lavieen", "Laser Ablativo e Fracionado"],
  ["Q-switched, remoção de tatuagem, despigmentação, remoção de micropigmentação", "Remoção de Pigmentação Estética"],
  ["endermo, endermoterapia, vacuoterapia, vácuo, dermotonus", "Endermoterapia e Vacuoterapia"],
  ["eletroestimulação, corrente russa, corrente aussie, ezbody, tensor, EMS", "Eletroestimulação Muscular"],
  ["ondas de choque, shockwave", "Ondas de Choque"],
  ["pressoterapia, bota compressiva", "Pressoterapia"],
  ["manta térmica, plataforma vibratória, vibro-oscilatória, modellata", "Terapias Corporais com Equipamento"],
  ["hidrolipoclasia, hidrolipo", "Hidrolipoclasia Não Aspirativa"],

  // Manuais e integrativas.
  ["drenagem, DLM, drenagem linfática manual", "Drenagem Linfática"],
  ["modeladora, massagem modeladora, redutora", "Massagem Modeladora"],
  ["relaxante, massagem terapêutica", "Massagem Terapêutica"],
  ["ventosa, ventosaterapia, liberação miofascial", "Liberação Miofascial com Ventosa"],
  ["auriculo, auriculoterapia, cone hindu, acupuntura auricular", "Auriculoterapia"],
  ["aroma, aromaterapia", "Aromaterapia"],

  // Auricular, piercing e íntimo.
  ["furo de orelha, perfuração, furo humanizado, brinco", "Perfuração Auricular"],
  ["piercing, body piercing", "Body Piercing"],
  ["lobuloplastia, lobulomodelação, fechamento de lóbulo", "Revitalização e Fechamento de Lóbulo Auricular"],
  ["otomodelação, orelha de elfo", "Otomodelação Não Cirúrgica"],
  ["clareamento íntimo, clareamento de virilha, clareamento de axila", "Clareamento Íntimo"],
  ["rejuvenescimento íntimo, íntima externa", "Rejuvenescimento Íntimo Externo"],

  // Capilar, corporal e outros.
  ["capilar injetável, mesoterapia capilar, terapia capilar", "Intradermoterapia Capilar"],
  ["estrias, tratamento de estrias", "Tratamento de Estrias"],
  ["cicatriz de acne, cicatrizes", "Tratamento de Cicatrizes de Acne"],
  ["melasma, clareamento de manchas, melanose", "Clareamento de Melasma, Melanose e Manchas Senis"],
  ["glúteo, pump up, harmonização glútea", "Harmonização Corporal Glútea"],
  ["podologia, pé diabético, onicomicose, unha encravada", "Podologia"],
  ["design, design de sobrancelha, henna", "Design de Sobrancelhas"],
  ["cílios, extensão de cílios, volume russo, lash", "Extensão de Cílios"],
];

/**
 * Termo que tem mais de um significado real na estética. Aqui a análise não escolhe:
 * devolve menção `uncertain` para o comercial confirmar com o cliente.
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
  ["preenchimento", "facial, corporal ou labial — confirmar região e produto"],
  ["detox", "protocolo próprio da casa — confirmar quais técnicas o compõem"],
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
