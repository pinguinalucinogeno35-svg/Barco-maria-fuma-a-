// Gera icones PNG da marca (fundo marinho + ondas) sem dependencias.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const topo = [7, 42, 105], base = [13, 75, 154], claro = [189, 224, 255];
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let cor = mix(topo, base, (u + v) / 2);
      // tres ondas brancas dentro da area segura (maskable): marca "frio"
      for (let k = 0; k < 3; k++) {
        const yc = 0.36 + k * 0.14 + 0.045 * Math.sin((u - 0.5) * 2 * Math.PI * 1.5 + k);
        if (u > 0.2 && u < 0.8 && Math.abs(v - yc) < 0.024) cor = k === 0 ? [255, 255, 255] : mix([255, 255, 255], claro, k / 2);
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = cor[0]; raw[i + 1] = cor[1]; raw[i + 2] = cor[2]; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const app of ['tecnico', 'vendas']) {
  const dir = `apps/${app}/public`;
  mkdirSync(dir, { recursive: true });
  for (const s of [192, 512]) writeFileSync(`${dir}/icone-${s}.png`, png(s));
}
