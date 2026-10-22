// Leitura e validacao de planilhas CSV de aparelhos (puro: sem rede, testavel).

export type Campo =
  | 'cliente' | 'documento' | 'telefone' | 'endereco'
  | 'marca' | 'modelo' | 'btus' | 'serie' | 'local'
  | 'instalacao' | 'ultima' | 'periodicidade';

export const CAMPOS: { chave: Campo; rotulo: string; obrigatorio?: boolean; sinonimos: string[] }[] = [
  { chave: 'cliente', rotulo: 'Cliente', obrigatorio: true, sinonimos: ['cliente', 'nome do cliente', 'nome cliente', 'razao social', 'nome', 'empresa', 'proprietario'] },
  { chave: 'documento', rotulo: 'CPF / CNPJ', sinonimos: ['cpf', 'cnpj', 'cpf cnpj', 'cnpj cpf', 'documento', 'doc'] },
  { chave: 'telefone', rotulo: 'Telefone', sinonimos: ['telefone', 'tel', 'celular', 'fone', 'whatsapp', 'contato'] },
  { chave: 'endereco', rotulo: 'Endereço', sinonimos: ['endereco', 'end', 'logradouro', 'rua', 'localizacao do cliente'] },
  { chave: 'marca', rotulo: 'Marca', sinonimos: ['marca', 'fabricante'] },
  { chave: 'modelo', rotulo: 'Modelo', sinonimos: ['modelo', 'model'] },
  { chave: 'btus', rotulo: 'BTUs', sinonimos: ['btus', 'btu', 'capacidade', 'potencia', 'btu h'] },
  { chave: 'serie', rotulo: 'Número de série', sinonimos: ['serie', 'numero de serie', 'n serie', 'n de serie', 'num serie', 'serial', 'no serie'] },
  { chave: 'local', rotulo: 'Local de instalação', sinonimos: ['local', 'local de instalacao', 'local instalacao', 'ambiente', 'sala', 'setor', 'localizacao', 'comodo'] },
  { chave: 'instalacao', rotulo: 'Data de instalação', sinonimos: ['data de instalacao', 'data instalacao', 'instalacao', 'instalado em', 'data da instalacao'] },
  { chave: 'ultima', rotulo: 'Última manutenção', sinonimos: ['ultima manutencao', 'data ultima manutencao', 'ultima limpeza', 'ultimo servico', 'ultima visita', 'data da ultima manutencao', 'ultima'] },
  { chave: 'periodicidade', rotulo: 'Periodicidade (dias)', sinonimos: ['periodicidade', 'periodicidade dias', 'intervalo', 'frequencia', 'prazo', 'a cada'] },
];

/** minusculas, sem acento nem pontuacao, espacos unificados: "N° Série" -> "n serie". */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** UTF-8; se a planilha veio do Excel antigo (Windows-1252) os acentos sao recuperados. */
export function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

/** CSV com aspas, separador ; , ou tab (detectado), BOM e quebras \r\n. Linhas vazias sao ignoradas. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', ',', '\t'].map((s) => ({ s, n: primeira.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const linhas: string[][] = [];
  let linha: string[] = [], cel = '', aspas = false;
  const fechaCel = () => { linha.push(cel); cel = ''; };
  const fechaLinha = () => {
    fechaCel();
    if (linha.some((c) => c.trim() !== '')) linhas.push(linha.map((c) => c.trim()));
    linha = [];
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else aspas = false; } else cel += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) fechaCel();
    else if (c === '\n') fechaLinha();
    else if (c === '\r') { /* \r\n tratado no \n */ } else cel += c;
  }
  if (cel !== '' || linha.length) fechaLinha();
  return linhas;
}

/** Sugere a coluna de cada campo pelo nome do cabecalho (-1 = nenhuma). Cada coluna serve a um campo so. */
export function sugerirMapeamento(cabecalhos: string[]): Record<Campo, number> {
  const norm = cabecalhos.map(normalizar);
  const usadas = new Set<number>();
  const mapa = {} as Record<Campo, number>;
  for (const campo of CAMPOS) {
    let achada = -1;
    for (const sin of campo.sinonimos) {            // sinonimos em ordem de preferencia
      const i = norm.findIndex((h, idx) => h === sin && !usadas.has(idx));
      if (i >= 0) { achada = i; break; }
    }
    if (achada < 0) {                                // aproximado: cabecalho contem o sinonimo
      for (const sin of campo.sinonimos) {
        const i = norm.findIndex((h, idx) => !usadas.has(idx) && h.length > 0 && (h.includes(sin) || sin.includes(h)) && h.length >= 3);
        if (i >= 0) { achada = i; break; }
      }
    }
    if (achada >= 0) usadas.add(achada);
    mapa[campo.chave] = achada;
  }
  return mapa;
}

const dataValida = (a: number, m: number, d: number) => {
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
};
const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd ou numero serial do Excel. undefined = vazio; null = invalido. */
export function parseData(t: string): string | null | undefined {
  const s = t.trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return dataValida(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (m) {
    let a = +m[3]; if (m[3].length === 2) a += a <= 50 ? 2000 : 1900;
    return dataValida(a, +m[2], +m[1]) ? iso(a, +m[2], +m[1]) : null;
  }
  if (/^\d{5}$/.test(s) && +s > 20000 && +s < 70000) {   // serial do Excel (dias desde 30/12/1899)
    const d = new Date(Date.UTC(1899, 11, 30) + +s * 86400000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/** "12000", "12.000", "12.000 BTUs", "12k" ou "12" (= 12000). undefined = vazio; null = invalido. */
export function parseBtus(t: string): number | null | undefined {
  const s = t.trim().toLowerCase();
  if (!s) return undefined;
  const k = s.match(/^(\d{1,3})\s*k\b/);
  if (k) return +k[1] * 1000;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const v = n < 100 ? n * 1000 : n;
  return v >= 1000 && v <= 200000 ? v : null;
}

const NOMES_PERIODO: Record<string, number> = { mensal: 30, bimestral: 60, trimestral: 90, quadrimestral: 120, semestral: 180, anual: 365 };
/** Dias ("30", "60 dias") ou palavras (mensal, trimestral, semestral, anual). undefined = vazio; null = invalido. */
export function parsePeriodicidade(t: string): number | null | undefined {
  const s = normalizar(t);
  if (!s) return undefined;
  if (NOMES_PERIODO[s]) return NOMES_PERIODO[s];
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= 3650 ? n : null;
}

export interface LinhaImportada {
  linha: number;            // numero da linha no arquivo (cabecalho = 1)
  cliente: string;
  chaveCliente: string;     // nome normalizado, para juntar variacoes do mesmo cliente
  documento: string | null; telefone: string | null; endereco: string | null;
  marca: string; modelo: string | null; btus: number | null; serie: string | null;
  local: string | null; instalacao: string | null; ultima: string | null; periodicidade: number | null;
  avisos: string[];
}
export type ResultadoLinha = { ok: LinhaImportada } | { erro: string; linha: number };

export const MARCA_PADRAO = 'Não informada';

export function validarLinha(celulas: string[], mapa: Record<Campo, number>, linha: number): ResultadoLinha {
  const v = (c: Campo) => (mapa[c] >= 0 ? (celulas[mapa[c]] ?? '').trim() : '');
  const cliente = v('cliente').replace(/\s+/g, ' ');
  if (!cliente) return { erro: 'Sem nome de cliente', linha };
  const avisos: string[] = [];
  const erros: string[] = [];

  const btus = parseBtus(v('btus')); if (btus === null) erros.push(`BTUs inválido ("${v('btus')}")`);
  const instalacao = parseData(v('instalacao')); if (instalacao === null) erros.push(`Data de instalação inválida ("${v('instalacao')}")`);
  const ultima = parseData(v('ultima')); if (ultima === null) erros.push(`Última manutenção inválida ("${v('ultima')}")`);
  const periodo = parsePeriodicidade(v('periodicidade')); if (periodo === null) erros.push(`Periodicidade inválida ("${v('periodicidade')}")`);
  if (erros.length) return { erro: erros.join('; '), linha };

  const hoje = new Date().toISOString().slice(0, 10);
  if (ultima && ultima > hoje) avisos.push('Última manutenção no futuro');
  const marca = v('marca');
  if (!marca) avisos.push(`Sem marca (será "${MARCA_PADRAO}")`);
  return {
    ok: {
      linha, cliente, chaveCliente: normalizar(cliente),
      documento: v('documento') || null, telefone: v('telefone') || null, endereco: v('endereco') || null,
      marca: marca || MARCA_PADRAO, modelo: v('modelo') || null, btus: btus ?? null, serie: v('serie') || null,
      local: v('local') || null, instalacao: instalacao ?? null, ultima: ultima ?? null, periodicidade: periodo ?? null,
      avisos,
    },
  };
}

/** Planilha modelo para baixar (abre no Excel em portugues). */
export const MODELO_CSV: string[][] = [
  ['Cliente', 'CPF/CNPJ', 'Telefone', 'Endereço', 'Marca', 'Modelo', 'BTUs', 'Número de série', 'Local de instalação', 'Data de instalação', 'Última manutenção', 'Periodicidade (dias)'],
  ['Instituto Exemplo', '00.000.000/0001-00', '(73) 99999-0000', 'Rua das Flores, 100, Ilhéus', 'LG', 'Dual Inverter', '12000', 'ABC123456', 'Sala 2', '15/03/2023', '10/09/2026', '30'],
  ['Maria Souza', '', '(73) 98888-0000', 'Av. Soares Lopes, 50', 'Samsung', '', '9000', '', 'Quarto', '', '', '90'],
];
