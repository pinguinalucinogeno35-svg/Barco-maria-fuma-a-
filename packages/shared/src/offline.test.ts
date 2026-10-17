import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetDb, enfileirar, pendentes, sincronizar, type Pendente } from './offline';

const base = (id: string): Omit<Pendente, 'tentativas' | 'criado_em'> => ({
  id, equipamento_id: 'e1', tecnico_id: 't1', tipo: 'preventiva',
  checklist: {}, observacoes: null, executada_em: new Date().toISOString(), fotos: [],
});

function sbFalso(insert: (row: any) => { error: any }) {
  return { from: () => ({ insert: async (r: any) => insert(r) }), storage: {} } as any;
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
