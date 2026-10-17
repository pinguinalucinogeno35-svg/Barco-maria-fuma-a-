import { describe, expect, it } from 'vitest';
import { extrairCodigo, gerarCodigo, urlDoQr } from './codigo';

describe('codigo', () => {
  it('gera codigos validos e distintos', () => {
    const s = new Set(Array.from({ length: 2000 }, gerarCodigo));
    expect(s.size).toBe(2000);
    for (const c of s) expect(extrairCodigo(c)).toBe(c);
  });
  it('extrai do QR e de texto digitado', () => {
    const c = gerarCodigo();
    expect(extrairCodigo(urlDoQr('https://t.exemplo.com/', c))).toBe(c);
    expect(extrairCodigo(`  ${c.toLowerCase()} `)).toBe(c);
    expect(extrairCodigo('https://outro-site.com/x')).toBeNull();
  });
});
