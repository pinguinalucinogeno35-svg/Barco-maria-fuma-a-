-- Descricao do servico executado em cada manutencao
alter table manutencoes add column servico text not null default '';

-- Tecnico pode corrigir modelo e local ao ler o QR; qualquer outra coluna continua restrita.
-- (politicas somam permissoes: admin segue em equip_edita; o gatilho abaixo limita as colunas do tecnico)
create policy equip_edita_tecnico on equipamentos for update to authenticated
  using (papel_atual() = 'tecnico');

create function restringe_edicao_equipamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if papel_atual() = 'tecnico'
     and (to_jsonb(new) - 'modelo' - 'local_instalacao' - 'atualizado_em')
         is distinct from (to_jsonb(old) - 'modelo' - 'local_instalacao' - 'atualizado_em') then
    raise exception 'tecnico so pode alterar modelo e local de instalacao' using errcode = '42501';
  end if;
  new.atualizado_em = now();
  return new;
end $$;
create trigger equipamentos_restringe before update on equipamentos
  for each row execute function restringe_edicao_equipamento();

-- Nome do tecnico congelado em cada registro: renomear ou desativar o perfil
-- depois nao altera o historico. Preenchido pelo banco, nao pelo celular.
alter table manutencoes add column tecnico_nome text not null default '';

create function congela_nome_tecnico() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select nome into new.tecnico_nome from perfis where id = new.tecnico_id;
  return new;
end $$;
create trigger manutencoes_nome before insert on manutencoes
  for each row execute function congela_nome_tecnico();
