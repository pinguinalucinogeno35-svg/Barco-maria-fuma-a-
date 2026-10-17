-- Esquema inicial: equipamentos com QR, historico de manutencao, perfis e RLS.

create type papel as enum ('tecnico', 'vendedor', 'admin');
create type tipo_manutencao as enum ('preventiva', 'corretiva', 'instalacao', 'limpeza');

create table perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  papel papel not null default 'tecnico',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  telefone text,
  endereco text,
  criado_em timestamptz not null default now()
);

create table equipamentos (
  id uuid primary key default gen_random_uuid(),
  -- codigo curto impresso na etiqueta e embutido no QR (ex.: AC-7K3M9Q2X)
  codigo text not null unique,
  cliente_id uuid not null references clientes on delete restrict,
  local_instalacao text,
  marca text not null,
  modelo text,
  btus int,
  numero_serie text,
  data_instalacao date,
  periodicidade_dias int not null default 30,
  ativo boolean not null default true,
  criado_por uuid references perfis,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on equipamentos (cliente_id);

-- id gerado no celular (uuid): reenviar o mesmo registro e idempotente.
create table manutencoes (
  id uuid primary key,
  equipamento_id uuid not null references equipamentos on delete restrict,
  tecnico_id uuid not null references perfis,
  tipo tipo_manutencao not null,
  checklist jsonb not null default '{}',
  observacoes text,
  fotos text[] not null default '{}',
  executada_em timestamptz not null,
  recebida_em timestamptz not null default now()
);
create index on manutencoes (equipamento_id, executada_em desc);
create index on manutencoes (tecnico_id, executada_em desc);

-- ultima manutencao e proxima data prevista, para listas e alertas
create view equipamentos_status as
select e.*,
       m.ultima_manutencao,
       coalesce(m.ultima_manutencao, e.data_instalacao::timestamptz)
         + make_interval(days => e.periodicidade_dias) as proxima_manutencao
from equipamentos e
left join lateral (
  select max(executada_em) as ultima_manutencao
  from manutencoes where equipamento_id = e.id
) m on true;
alter view equipamentos_status set (security_invoker = true);

-- Helpers de papel (security definer evita recursao nas politicas)
create function papel_atual() returns papel
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

alter table perfis enable row level security;
alter table clientes enable row level security;
alter table equipamentos enable row level security;
alter table manutencoes enable row level security;

create policy perfis_le on perfis for select to authenticated using (papel_atual() is not null);
create policy perfis_admin on perfis for all to authenticated
  using (papel_atual() = 'admin') with check (papel_atual() = 'admin');

create policy clientes_le on clientes for select to authenticated using (papel_atual() is not null);
create policy clientes_escreve on clientes for insert to authenticated
  with check (papel_atual() in ('vendedor', 'admin'));
create policy clientes_edita on clientes for update to authenticated
  using (papel_atual() in ('vendedor', 'admin'));

create policy equip_le on equipamentos for select to authenticated using (papel_atual() is not null);
create policy equip_escreve on equipamentos for insert to authenticated
  with check (papel_atual() in ('vendedor', 'admin'));
create policy equip_edita on equipamentos for update to authenticated
  using (papel_atual() in ('vendedor', 'admin'));

create policy manut_le on manutencoes for select to authenticated using (papel_atual() is not null);
-- tecnico so registra em seu proprio nome; historico nunca e editado/apagado
create policy manut_insere on manutencoes for insert to authenticated
  with check (papel_atual() in ('tecnico', 'admin') and tecnico_id = auth.uid());

-- Fotos de manutencao
insert into storage.buckets (id, name, public) values ('manutencoes', 'manutencoes', false)
on conflict do nothing;
create policy fotos_le on storage.objects for select to authenticated
  using (bucket_id = 'manutencoes' and papel_atual() is not null);
create policy fotos_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'manutencoes' and papel_atual() in ('tecnico', 'admin'));
