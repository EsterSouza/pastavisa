-- Retenção: a pasta concluída é excluída 30 dias depois de concluída.
alter table public."Pasta" add column if not exists "concluidaEm" timestamptz;

-- As pastas concluídas antes desta coluna não guardaram a data. A última
-- atividade nelas (geração, versão, correção) é a melhor aproximação.
update public."Pasta" p
set "concluidaEm" = greatest(
  p."criadaEm",
  (select max(g."criadoEm") from public."DocumentoGerado" g where g."pastaId" = p.id),
  (select max(v."criadaEm") from public."DocumentoVersao" v
     join public."DocumentoGerado" g on g.id = v."documentoId" where g."pastaId" = p.id),
  (select max(u."criadoEm") from public."DocumentoUpload" u where u."pastaId" = p.id),
  (select max(uv."criadaEm") from public."DocumentoUploadVersao" uv
     join public."DocumentoUpload" u on u.id = uv."documentoUploadId" where u."pastaId" = p.id)
)
where p.status = 'concluida' and p."concluidaEm" is null;
