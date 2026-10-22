-- Funcoes de relatorio: somam no banco (SECURITY INVOKER: respeitam as permissoes de quem chama).
-- Servicos cancelados nunca entram nas contas.

create function relatorio_servicos(p_de date, p_ate date)
returns table (tecnico_id uuid, tecnico_nome text, tipo tipo_manutencao, total int)
language sql stable set search_path = public as $$
  select m.tecnico_id,
         (array_agg(m.tecnico_nome order by m.executada_em desc))[1],
         m.tipo,
         count(*)::int
  from manutencoes m
  where m.cancelada_em is null
    and m.executada_em >= (p_de::timestamp at time zone 'America/Sao_Paulo')
    and m.executada_em <  ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
  group by m.tecnico_id, m.tipo
  order by 2, m.tipo
$$;

create function servicos_por_mes(p_meses int default 12)
returns table (mes date, total int)
language sql stable set search_path = public as $$
  with g as (
    select (date_trunc('month', now() at time zone 'America/Sao_Paulo') - (n || ' months')::interval)::date as mes
    from generate_series(0, greatest(p_meses, 1) - 1) n
  ), c as (
    select date_trunc('month', executada_em at time zone 'America/Sao_Paulo')::date as mes, count(*) as total
    from manutencoes where cancelada_em is null group by 1
  )
  select g.mes, coalesce(c.total, 0)::int from g left join c using (mes) order by g.mes
$$;

create function resumo_vencidos(p_dias int default 0)
returns table (cliente_id uuid, cliente_nome text, aparelhos int, mais_antigo timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.nome, count(*)::int, min(s.proxima_manutencao)
  from equipamentos_status s join clientes c on c.id = s.cliente_id
  where s.ativo and s.proxima_manutencao is not null
    and s.proxima_manutencao < now() + make_interval(days => p_dias)
  group by c.id, c.nome
  order by 3 desc, 4
$$;

create function resumo_geral()
returns table (aparelhos int, vencidos int, vencem_7 int, vencem_30 int, nunca_atendidos int, servicos_mes int, servicos_mes_anterior int)
language sql stable set search_path = public as $$
  with mes as (select (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo' as inicio)
  select
    (select count(*) from equipamentos where ativo)::int,
    (select count(*) from equipamentos_status where ativo and proxima_manutencao < now())::int,
    (select count(*) from equipamentos_status where ativo and proxima_manutencao >= now() and proxima_manutencao < now() + interval '7 days')::int,
    (select count(*) from equipamentos_status where ativo and proxima_manutencao >= now() and proxima_manutencao < now() + interval '30 days')::int,
    (select count(*) from equipamentos_status where ativo and ultima_manutencao is null)::int,
    (select count(*) from manutencoes, mes where cancelada_em is null and executada_em >= mes.inicio)::int,
    (select count(*) from manutencoes, mes where cancelada_em is null and executada_em >= mes.inicio - interval '1 month' and executada_em < mes.inicio)::int
$$;

revoke execute on function relatorio_servicos(date, date), servicos_por_mes(int), resumo_vencidos(int), resumo_geral() from public, anon;
grant execute on function relatorio_servicos(date, date), servicos_por_mes(int), resumo_vencidos(int), resumo_geral() to authenticated;
