// Sem 0/O/1/I/L para evitar confusao ao ler a etiqueta impressa.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PREFIXO = 'AC-';
const TAMANHO = 8;
const PADRAO = new RegExp(`${PREFIXO}[${ALFABETO}]{${TAMANHO}}`, 'i');

export function gerarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TAMANHO));
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return PREFIXO + s;
}

/** Aceita o codigo puro, a URL do QR ou texto digitado a mao. */
export function extrairCodigo(texto: string): string | null {
  const m = texto.trim().toUpperCase().match(PADRAO);
  return m ? m[0] : null;
}

export function urlDoQr(baseUrl: string, codigo: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/e/${codigo}`;
}
