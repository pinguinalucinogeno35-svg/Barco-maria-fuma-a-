-- Regra de insercao de servicos avalia auth.uid() uma vez por consulta, nao por linha.
alter policy manut_insere on manutencoes
  with check (papel_atual() in ('tecnico', 'admin') and tecnico_id = (select auth.uid()));

-- Indices nas chaves estrangeiras de auditoria.
create index if not exists equipamentos_criado_por_idx on equipamentos (criado_por);
create index if not exists etiquetas_criada_por_idx on etiquetas (criada_por);
create index if not exists manutencoes_cancelada_por_idx on manutencoes (cancelada_por) where cancelada_por is not null;
create index if not exists manutencoes_editada_por_idx on manutencoes (editada_por) where editada_por is not null;
