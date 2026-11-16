-- Etapa da pasta depois da geração: apreciacao, revisao ou impressao
-- (lib/etapas.ts). "Entregue" continua sendo status = 'concluida'.
alter table public."Pasta" add column if not exists "etapa" text;

-- Quem já recebeu o e-mail de apreciação e não foi entregue está em apreciação.
update public."Pasta" p set "etapa" = 'apreciacao'
where p.status <> 'concluida' and p."etapa" is null
  and exists (select 1 from public."EmailEnviado" e where e."pastaId" = p.id and e.tipo = 'apreciacao');

-- Entregue passa a ser o envio do e-mail de entrega, não o fim da geração:
-- quem recebeu a entrega fica concluída a partir dela, e a retenção de 30 dias
-- conta dessa data (nunca antes da data que já estava gravada).
update public."Pasta" p set status = 'concluida',
  "concluidaEm" = greatest(coalesce(p."concluidaEm", e.primeira), e.primeira)
from (
  select "pastaId", min("enviadoEm") as primeira from public."EmailEnviado"
  where tipo in ('entrega-fisica', 'entrega-digital') group by "pastaId"
) e
where e."pastaId" = p.id;
