-- Etiquetas QR: o admin gera lotes de codigos para imprimir; o tecnico, em campo,
-- le uma etiqueta ainda sem aparelho e cadastra o equipamento nela.
create table etiquetas (
  codigo text primary key,
  criada_em timestamptz not null default now(),
  criada_por uuid references perfis
);
alter table etiquetas enable row level security;
create policy etiquetas_le on etiquetas for select to authenticated using (papel_atual() is not null);
create policy etiquetas_cria on etiquetas for insert to authenticated with check (papel_atual() = 'admin');

alter table equipamentos
  add constraint equipamentos_codigo_fk foreign key (codigo) references etiquetas (codigo);

-- Tecnico tambem cadastra equipamento (id gerado no celular, para funcionar offline).
drop policy equip_escreve on equipamentos;
create policy equip_escreve on equipamentos for insert to authenticated
  with check (papel_atual() in ('admin', 'tecnico'));

-- Servicos: admin corrige e cancela; nada e apagado.
alter table manutencoes
  add column editada_em timestamptz,
  add column editada_por uuid references perfis,
  add column cancelada_em timestamptz,
  add column cancelada_por uuid references perfis,
  add column cancelada_motivo text;

create policy manut_admin_edita on manutencoes for update to authenticated
  using (papel_atual() = 'admin') with check (papel_atual() = 'admin');

create function restringe_edicao_manutencao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'tipo' - 'servico' - 'observacoes' - 'checklist' - 'executada_em'
        - 'editada_em' - 'editada_por' - 'cancelada_em' - 'cancelada_por' - 'cancelada_motivo')
     is distinct from
     (to_jsonb(old) - 'tipo' - 'servico' - 'observacoes' - 'checklist' - 'executada_em'
        - 'editada_em' - 'editada_por' - 'cancelada_em' - 'cancelada_por' - 'cancelada_motivo') then
    raise exception 'campo imutavel da manutencao' using errcode = '42501';
  end if;
  new.editada_em = now();
  new.editada_por = auth.uid();
  if new.cancelada_em is not null and old.cancelada_em is null then
    new.cancelada_por = auth.uid();
  end if;
  return new;
end $$;
create trigger manutencoes_restringe before update on manutencoes
  for each row execute function restringe_edicao_manutencao();

-- Servicos cancelados nao contam para a proxima manutencao.
create or replace view equipamentos_status as
select e.*,
       m.ultima_manutencao,
       coalesce(m.ultima_manutencao, e.data_instalacao::timestamptz)
         + make_interval(days => e.periodicidade_dias) as proxima_manutencao
from equipamentos e
left join lateral (
  select max(executada_em) as ultima_manutencao
  from manutencoes where equipamento_id = e.id and cancelada_em is null
) m on true;
alter view equipamentos_status set (security_invoker = true);

-- Quantos servicos cada tecnico fez por mes.
create view resumo_servicos as
select tecnico_id, tecnico_nome,
       date_trunc('month', executada_em at time zone 'America/Sao_Paulo')::date as mes,
       count(*)::int as total
from manutencoes
where cancelada_em is null
group by 1, 2, 3;
alter view resumo_servicos set (security_invoker = true);

create index on manutencoes (executada_em desc);
