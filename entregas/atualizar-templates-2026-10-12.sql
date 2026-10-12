-- Envio de 12/10/2026: 112 templates entraram como novos em vez de atualizar os existentes.
-- Este script deixa o acervo igual à pasta TODOS_OS_TEMPLATES_PastaVISA (raiz, sem a "versão longa").
--
-- 1. 109 pares: o arquivo novo passa para o template antigo (mantém id, nome revisado e histórico);
--    o arquivo antigo fica em "Versões anteriores" e a linha nova repetida sai.
-- 2. TCLE Massoterapia substitui TCLE Massagem Terapêutica (incluído nos 109).
-- 3. 3 TCLEs realmente novos ganham nome no padrão.
-- 4. 6 templates que não estão mais na pasta são desativados (não excluídos).
-- Nenhum dos 112 novos tinha documento gerado. Para voltar um arquivo: Templates > Versões anteriores.

begin;
create temp table par on commit drop as
with t as (select id, "criadoEm">'2026-10-08' novo, upper(regexp_replace(regexp_replace("arquivoPath",'^.*/(\d+_)?(bulk_\d+_)?',''),'[^A-Za-z0-9]+','','g')) k from "Template")
select o.id old_id, n.id new_id from t o join t n on n.k=o.k and n.novo and not o.novo
union all select 'cmquvp85q000004jrpz8d8pvy', 'cmv4z9ukp003006l8am0hcgml';

insert into "TemplateVersao" (id,"templateId",nome,tipo,"padraoHeader","processingType","arquivoPath",motivo,"criadaEm")
select gen_random_uuid()::text, o.id, o.nome, o.tipo, o."padraoHeader", o."processingType", o."arquivoPath", 'Antes da atualização pelo envio de 12/10/2026', now()
from "Template" o join par on par.old_id=o.id;

update "Template" o set "arquivoPath"=n."arquivoPath", "processingType"=n."processingType", ativo=true
from par join "Template" n on n.id=par.new_id where o.id=par.old_id;

update "Template" set nome='TCLE - Massoterapia (Massagem Terapêutica Relaxante e Redutora)' where id='cmquvp85q000004jrpz8d8pvy';

delete from "Template" where id in (select new_id from par);

update "Template" set nome='TCLE - TENS' where id='cmv4z9nce002y06l8bnkpa5zv';
update "Template" set nome='TCLE - Fototerapia por LED' where id='cmv4z9vj6003106l87193pwf9';
update "Template" set nome='TCLE - Clareamento de Pele Químico e Enzimático' where id='cmv4z9wcz003206l8vjkev3k4';

update "Template" set ativo=false where id in (
  'cmp161q58001uewyx1i1ynivc', -- POP - Preenchimento com Ácido Hialurônico
  'cmqdshx01000b04laubauv4rq', -- POP - Terapias Manuais Corporais
  'cmquuqm7s000704k1c0ge3nfq', -- TCLE - Depilação à Cera
  'cmt00mcoa000004iamgjvvq2w', -- TCLE - Plástica dos Pés
  'cmr6b3yxv000004ky1egw11a2', -- POP - Administração de Anestésico Local
  'cmqfohkfj000804kw3jbuk9im'  -- TCLE - Terapias Manuais Corporais (Massagem, Drenagem Linfática e Ventosaterapia)
);

select (select count(*) from par) pares, (select count(*) from "Template") total, (select count(*) from "Template" where ativo) ativos;
commit;
