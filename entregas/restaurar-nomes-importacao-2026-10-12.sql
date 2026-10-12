-- A importação antiga (antes do commit 7cb4e3f) trocava o nome revisado pelo nome do arquivo
-- quando o template era atualizado. No envio de 12/10/2026 isso atingiu 40 templates
-- (ex.: "TCLE - Subcisão" virou "TCLE - SUBCISAO"). Este script devolve o nome aprovado
-- em 08/10/2026, guardado no histórico de versões. O arquivo novo continua.

begin;
update "Template" t set nome=v.nome
from "TemplateVersao" v
where v."templateId"=t.id and v.motivo='Antes da atualizacao por importacao em lote' and v."criadaEm">'2026-10-12' and v.nome<>t.nome;
select count(*) filter (where ativo) ativos, count(*) total,
 (select count(*) from (select nome from "Template" where ativo group by nome having count(*)>1) x) nomes_repetidos
from "Template";
commit;
