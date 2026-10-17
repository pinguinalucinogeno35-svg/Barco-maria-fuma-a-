import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Checklist, EquipamentoStatus, Manutencao, TipoManutencao } from './types';
import type { Supabase } from './supabase';

export interface Pendente {
  id: string; // uuid da manutencao: chave de idempotencia
  equipamento_id: string;
  tecnico_id: string;
  tipo: TipoManutencao;
  checklist: Checklist;
  observacoes: string | null;
  executada_em: string;
  fotos: Blob[];
  tentativas: number;
  erro?: string;
  criado_em: number;
}

export interface Ficha {
  equipamento: EquipamentoStatus;
  cliente_nome: string;
  historico: Manutencao[];
  salvo_em: number;
}

interface Schema extends DBSchema {
  fila: { key: string; value: Pendente; indexes: { por_criacao: number } };
  fichas: { key: string; value: Ficha }; // chave: codigo do equipamento
}

const MAX_FICHAS = 300;
let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  dbPromise ??= openDB<Schema>('ac-offline', 1, {
    upgrade(d) {
      d.createObjectStore('fila', { keyPath: 'id' }).createIndex('por_criacao', 'criado_em');
      d.createObjectStore('fichas');
    },
  });
  return dbPromise;
}

// Visivel so em testes, para recriar o banco entre casos.
export function _resetDb() { dbPromise = null; }

export async function enfileirar(p: Omit<Pendente, 'tentativas' | 'criado_em'>) {
  await (await db()).put('fila', { ...p, tentativas: 0, criado_em: Date.now() });
}

export async function pendentes(): Promise<Pendente[]> {
  return (await db()).getAllFromIndex('fila', 'por_criacao');
}

export async function salvarFicha(codigo: string, ficha: Omit<Ficha, 'salvo_em'>) {
  const d = await db();
  await d.put('fichas', { ...ficha, salvo_em: Date.now() }, codigo);
  const total = await d.count('fichas');
  if (total > MAX_FICHAS) {
    const todas = await d.getAll('fichas');
    const keys = await d.getAllKeys('fichas');
    const ordem = keys.map((k, i) => ({ k, t: todas[i].salvo_em })).sort((a, b) => a.t - b.t);
    for (const { k } of ordem.slice(0, total - MAX_FICHAS)) await d.delete('fichas', k);
  }
}

export async function lerFicha(codigo: string): Promise<Ficha | undefined> {
  return (await db()).get('fichas', codigo);
}

/** Entrega a ficha para a tela: inclui o que ainda esta na fila local. */
export async function pendentesDoEquipamento(equipamentoId: string) {
  return (await pendentes()).filter((p) => p.equipamento_id === equipamentoId);
}

const ERRO_PERMANENTE = new Set(['42501', '23503', '22P02', '23514']);

/**
 * Envia a fila em ordem. Seguro chamar varias vezes ao mesmo tempo (trava) e
 * reenviar o mesmo registro (insert com id fixo; duplicata conta como sucesso).
 */
let sincronizando = false;
export async function sincronizar(sb: Supabase): Promise<{ enviados: number; restantes: number }> {
  if (sincronizando) return { enviados: 0, restantes: (await pendentes()).length };
  sincronizando = true;
  let enviados = 0;
  try {
    const d = await db();
    for (const p of await pendentes()) {
      try {
        const urls: string[] = [];
        for (let i = 0; i < p.fotos.length; i++) {
          const caminho = `${p.equipamento_id}/${p.id}/${i}.jpg`;
          const { error } = await sb.storage
            .from('manutencoes')
            .upload(caminho, p.fotos[i], { upsert: true, contentType: 'image/jpeg' });
          if (error) throw error;
          urls.push(caminho);
        }
        const { error } = await sb.from('manutencoes').insert({
          id: p.id,
          equipamento_id: p.equipamento_id,
          tecnico_id: p.tecnico_id,
          tipo: p.tipo,
          checklist: p.checklist,
          observacoes: p.observacoes,
          fotos: urls,
          executada_em: p.executada_em,
        });
        if (error && error.code !== '23505') throw error;
        await d.delete('fila', p.id);
        enviados++;
      } catch (e) {
        const err = e as { code?: string; message?: string; status?: number; statusCode?: string };
        const permanente = !!err.code && ERRO_PERMANENTE.has(err.code);
        await d.put('fila', {
          ...p,
          tentativas: p.tentativas + 1,
          erro: permanente ? (err.message ?? 'erro') : undefined,
        });
        if (!permanente) break; // sem rede ou servidor ocupado: tenta de novo depois
      }
    }
  } finally {
    sincronizando = false;
  }
  return { enviados, restantes: (await pendentes()).length };
}
