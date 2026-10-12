-- Remove os 6 templates inativos: todos foram substituídos por versões novas do acervo
-- (pasta TODOS_OS_TEMPLATES_PastaVISA) na atualização de 12/10/2026.
--   POP - Administração de Anestésico Local       -> POP - Administração de Anestésico Local em Saúde Reprodutiva
--   POP - Preenchimento com Ácido Hialurônico     -> POP - Preenchimento Dérmico com Ácido Hialurônico
--   POP - Terapias Manuais Corporais              -> POP Massoterapia (Massagem Terapêutica Relaxante e Redutora)
--   TCLE - Depilação à Cera                       -> TCLE - Epilação à Cera
--   TCLE - Plástica dos Pés                       -> TCLE - Spa dos Pés (Plástica dos Pés)
--   TCLE - Terapias Manuais Corporais (...)       -> TCLE - Massoterapia (Massagem Terapêutica Relaxante e Redutora)
-- O único documento gerado com um deles (Belle Dose Care, pasta concluída) passa a apontar
-- para o substituto. As versões antigas (TemplateVersao) saem junto por cascade.
begin;

update "DocumentoGerado" set "templateId" = 'cmu5el2is000504l6duxghul6'
where "templateId" = 'cmquuqm7s000704k1c0ge3nfq';

delete from "Template"
where ativo = false
  and id in (
    'cmr6b3yxv000004ky1egw11a2',
    'cmp161q58001uewyx1i1ynivc',
    'cmqdshx01000b04laubauv4rq',
    'cmquuqm7s000704k1c0ge3nfq',
    'cmt00mcoa000004iamgjvvq2w',
    'cmqfohkfj000804kw3jbuk9im'
  );

select count(*) filter (where ativo) as ativos, count(*) filter (where not ativo) as inativos from "Template";

commit;
