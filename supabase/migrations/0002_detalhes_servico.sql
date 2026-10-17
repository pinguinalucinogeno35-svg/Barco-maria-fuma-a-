-- Descricao do servico executado em cada manutencao
alter table manutencoes add column servico text not null default '';

-- Tecnico pode corrigir modelo e local ao ler o QR; qualquer outra coluna continua restrita.
drop policy equip_edita on equipamentos;
create policy equip_edita on equipamentos for update to authenticated
  using (papel_atual() in ('vendedor', 'admin', 'tecnico'));

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
