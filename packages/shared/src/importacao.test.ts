import { describe, expect, it } from 'vitest';
import { decodificar, lerCsv, normalizar, parseBtus, parseData, parsePeriodicidade, sugerirMapeamento, validarLinha } from './importacao';

describe('lerCsv', () => {
  it('detecta ; e entende aspas, ; dentro de campo e quebras de linha', () => {
    const r = lerCsv('﻿Cliente;Obs\r\n"Silva; Cia";"duas ""aspas"""\r\n\r\nJoão;x\r\n');
    expect(r).toEqual([['Cliente', 'Obs'], ['Silva; Cia', 'duas "aspas"'], ['João', 'x']]);
  });
  it('detecta virgula e tab', () => {
    expect(lerCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(lerCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('campo com quebra de linha entre aspas', () => {
    expect(lerCsv('a;b\n"x\ny";z')).toEqual([['a', 'b'], ['x\ny', 'z']]);
  });
});

describe('decodificar', () => {
  it('recupera acentos de arquivo Windows-1252', () => {
    const win = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]); // "João" em latin1
    expect(decodificar(win.buffer)).toBe('João');
    expect(decodificar(new TextEncoder().encode('João').buffer)).toBe('João');
  });
});

describe('parsers', () => {
  it('datas', () => {
    expect(parseData('15/03/2023')).toBe('2023-03-15');
    expect(parseData('5-3-23')).toBe('2023-03-05');
    expect(parseData('2023-03-15')).toBe('2023-03-15');
    expect(parseData('45000')).toBe('2023-03-15');
    expect(parseData('')).toBeUndefined();
    expect(parseData('31/02/2023')).toBeNull();
    expect(parseData('amanhã')).toBeNull();
  });
  it('btus', () => {
    expect(parseBtus('12000')).toBe(12000);
    expect(parseBtus('12.000 BTUs')).toBe(12000);
    expect(parseBtus('18k')).toBe(18000);
    expect(parseBtus('12')).toBe(12000);
    expect(parseBtus('')).toBeUndefined();
    expect(parseBtus('abc')).toBeNull();
  });
  it('periodicidade', () => {
    expect(parsePeriodicidade('Mensal')).toBe(30);
    expect(parsePeriodicidade('Semestral')).toBe(180);
    expect(parsePeriodicidade('45 dias')).toBe(45);
    expect(parsePeriodicidade('')).toBeUndefined();
    expect(parsePeriodicidade('nunca')).toBeNull();
  });
  it('normalizar', () => expect(normalizar('N° Série ')).toBe('n serie'));
});

describe('sugerirMapeamento', () => {
  it('reconhece cabecalhos comuns sem repetir coluna', () => {
    const m = sugerirMapeamento(['Nome do Cliente', 'CNPJ/CPF', 'Fabricante', 'Modelo', 'Capacidade (BTUs)', 'Nº Série', 'Ambiente', 'Última Manutenção']);
    expect(m.cliente).toBe(0); expect(m.documento).toBe(1); expect(m.marca).toBe(2); expect(m.modelo).toBe(3);
    expect(m.btus).toBe(4); expect(m.serie).toBe(5); expect(m.local).toBe(6); expect(m.ultima).toBe(7);
    expect(m.telefone).toBe(-1);
  });
});

describe('validarLinha', () => {
  const mapa = sugerirMapeamento(['Cliente', 'Marca', 'BTUs', 'Última manutenção']);
  it('aceita e normaliza', () => {
    const r = validarLinha(['  Maria   Souza ', 'LG', '12.000', '10/09/2026'], mapa, 2);
    expect('ok' in r && r.ok).toMatchObject({ cliente: 'Maria Souza', chaveCliente: 'maria souza', marca: 'LG', btus: 12000, ultima: '2026-09-10' });
  });
  it('marca vazia vira padrao com aviso', () => {
    const r = validarLinha(['Ana', '', '', ''], mapa, 3);
    expect('ok' in r && r.ok.marca).toBe('Não informada');
    expect('ok' in r && r.ok.avisos.length).toBe(1);
  });
  it('rejeita sem cliente e com data/btus invalidos', () => {
    expect(validarLinha(['', 'LG', '', ''], mapa, 4)).toMatchObject({ erro: 'Sem nome de cliente' });
    const r = validarLinha(['Ana', 'LG', 'xx', '99/99/2020'], mapa, 5);
    expect('erro' in r && r.erro).toMatch(/BTUs inválido.*Última manutenção inválida/);
  });
});
