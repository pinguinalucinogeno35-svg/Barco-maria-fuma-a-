import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetDb, enfileirar, pendentes, sincronizar, type Pendente } from './offline';

const base = (id: string): Omit<Pendente, 'tentativas' | 'criado_em'> => ({
  id, equipamento_id: 'e1', tecnico_id: 't1', tipo: 'preventiva', servico: 'Limpeza de filtros',
  checklist: {}, observacoes: null, executada_em: new Date().toISOString(), fotos: [],
});

function sbFalso(insert: (row: any) => { error: any }, update: () => { error: any } = () => ({ error: null })) {
  return { from: () => ({ insert: async (r: any) => insert(r), update: () => ({ eq: async () => update() }) }), storage: {} } as any;
}

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); _resetDb(); });

describe('sincronizar', () => {
  it('envia em ordem e esvazia a fila', async () => {
    await enfileirar(base('a')); await enfileirar(base('b'));
    const ordem: string[] = [];
    const r = await sincronizar(sbFalso((row) => (ordem.push(row.id), { error: null })));
    expect(ordem).toEqual(['a', 'b']);
    expect(r).toEqual({ enviados: 2, restantes: 0 });
  });
  it('trata duplicata como sucesso (reenvio idempotente)', async () => {
    await enfileirar(base('a'));
    const r = await sincronizar(sbFalso(() => ({ error: { code: '23505' } })));
    expect(r.restantes).toBe(0);
  });
  it('para na falha de rede e mantem o resto na fila', async () => {
    await enfileirar(base('a')); await enfileirar(base('b'));
    const r = await sincronizar(sbFalso(() => ({ error: { message: 'Failed to fetch' } })));
    expect(r).toEqual({ enviados: 0, restantes: 2 });
    expect((await pendentes())[0].tentativas).toBe(1);
  });
  it('marca erro permanente sem travar a fila', async () => {
    await enfileirar(base('a')); await enfileirar(base('b'));
    let n = 0;
    const r = await sincronizar(sbFalso(() => (n++ === 0 ? { error: { code: '42501', message: 'rls' } } : { error: null })));
    expect(r.enviados).toBe(1);
    const p = await pendentes();
    expect(p).toHaveLength(1);
    expect(p[0].erro).toBe('rls');
  });
});

describe('edicoes de equipamento', () => {
  it('envia a edicao e atualiza a ficha em cache', async () => {
    const { enfileirarEdicao, salvarFicha, lerFicha, edicoesPendentes } = await import('./offline');
    await salvarFicha('AC-X', { equipamento: { id: 'e1', modelo: null, local_instalacao: null } as any, cliente_nome: 'C', historico: [] });
    await enfileirarEdicao('AC-X', 'e1', { modelo: 'Inverter 12k', local_instalacao: 'Sala 2' });
    expect((await lerFicha('AC-X'))!.equipamento.modelo).toBe('Inverter 12k');
    const r = await sincronizar(sbFalso(() => ({ error: null })));
    expect(r.restantes).toBe(0);
    expect(await edicoesPendentes()).toHaveLength(0);
  });
  it('mantem a edicao se estiver sem rede', async () => {
    const { enfileirarEdicao, edicoesPendentes } = await import('./offline');
    await enfileirarEdicao('AC-X', 'e1', { modelo: 'A', local_instalacao: null });
    await sincronizar(sbFalso(() => ({ error: null }), () => ({ error: { message: 'Failed to fetch' } })));
    expect(await edicoesPendentes()).toHaveLength(1);
  });
});

describe('equipamentos cadastrados offline', () => {
  const dados: any = { id: 'n1', codigo: 'AC-AAAAAAAA', cliente_id: 'c1', marca: 'LG' };
  it('envia o equipamento antes das manutencoes dele', async () => {
    const { enfileirarEquipamento, lerFicha } = await import('./offline');
    await enfileirarEquipamento(dados, 't1', 'Cliente X');
    expect((await lerFicha('AC-AAAAAAAA'))!.cliente_nome).toBe('Cliente X');
    await enfileirar({ ...base('m1'), equipamento_id: 'n1' });
    const ordem: string[] = [];
    const sb: any = { from: (t: string) => ({ insert: async (r: any) => (ordem.push(t), { error: null }) }), storage: {} };
    const r = await sincronizar(sb);
    expect(ordem).toEqual(['equipamentos', 'manutencoes']);
    expect(r.restantes).toBe(0);
  });
  it('etiqueta ja usada por outra pessoa vira erro, sem travar a fila', async () => {
    const { enfileirarEquipamento, novosPendentes } = await import('./offline');
    await enfileirarEquipamento(dados, 't1', 'X');
    const sb: any = { from: () => ({ insert: async () => ({ error: { code: '23505', message: 'duplicate key ... equipamentos_codigo_key' } }) }), storage: {} };
    await sincronizar(sb);
    expect((await novosPendentes())[0].erro).toMatch(/outra pessoa/);
  });
});
