-- Importacao de aparelhos por planilha: lotes rastreaveis e desfazer seguro.

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  criada_em timestamptz not null default now(),
  criada_por uuid not null references perfis,
  arquivo text,
  linhas_lidas int not null default 0,
  equipamento_ids uuid[] not null default '{}',
  cliente_ids uuid[] not null default '{}',
  concluida boolean not null default false,
  desfeita_em timestamptz
);
create index on importacoes (criada_por);
alter table importacoes enable row level security;
create policy importacoes_admin on importacoes for all to authenticated
  using (papel_atual() = 'admin') with check (papel_atual() = 'admin');

-- Data da ultima manutencao informada na planilha (nao e um servico: nao entra nos relatorios de servicos).
create table importacoes_ultima (
  equipamento_id uuid primary key references equipamentos on delete cascade,
  data date not null
);
alter table importacoes_ultima enable row level security;
create policy iu_le on importacoes_ultima for select to authenticated using (papel_atual() is not null);
create policy iu_insere on importacoes_ultima for insert to authenticated with check (papel_atual() = 'admin');
create policy iu_edita on importacoes_ultima for update to authenticated using (papel_atual() = 'admin');

-- A ultima manutencao passa a ser a mais recente entre os servicos lancados e a data importada.
-- Sem nenhuma data (nem manutencao, nem instalacao), o prazo conta a partir do cadastro.
create or replace view equipamentos_status as
select e.*,
       m.ultima_manutencao,
       coalesce(m.ultima_manutencao, e.data_instalacao::timestamptz, e.criado_em)
         + make_interval(days => e.periodicidade_dias) as proxima_manutencao
from equipamentos e
left join lateral (
  select greatest(
    (select max(executada_em) from manutencoes where equipamento_id = e.id and cancelada_em is null),
    (select iu.data::timestamp at time zone 'America/Sao_Paulo' from importacoes_ultima iu where iu.equipamento_id = e.id)
  ) as ultima_manutencao
) m on true;
alter view equipamentos_status set (security_invoker = true);

-- Desfaz um lote: arquiva (ativo = false) os aparelhos que ele criou. Nada e apagado,
-- entao historico e codigos de etiqueta continuam consistentes.
create function desfazer_importacao(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare imp importacoes; n int;
begin
  if papel_atual() is distinct from 'admin' then
    raise exception 'apenas administradores' using errcode = '42501';
  end if;
  select * into imp from importacoes where id = p_id for update;
  if not found then raise exception 'importacao nao encontrada'; end if;
  if imp.desfeita_em is not null then raise exception 'importacao ja desfeita'; end if;
  update equipamentos set ativo = false where id = any(imp.equipamento_ids) and ativo;
  get diagnostics n = row_count;
  update importacoes set desfeita_em = now() where id = p_id;
  return jsonb_build_object('aparelhos_arquivados', n);
end $$;
revoke execute on function desfazer_importacao(uuid) from public, anon;
grant execute on function desfazer_importacao(uuid) to authenticated;
