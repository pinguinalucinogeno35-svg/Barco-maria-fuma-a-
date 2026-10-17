// Gera icones PNG simples (fundo azul + circulo branco) sem dependencias.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

function png(size, cor) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2, r = size * 0.28, r2 = size * 0.17;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const anel = d < r && d > r2;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const [R, G, B] = anel ? [255, 255, 255] : cor;
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [app, cor] of [['tecnico', [11, 111, 184]], ['vendas', [26, 127, 75]]]) {
  const dir = `apps/${app}/public`;
  mkdirSync(dir, { recursive: true });
  for (const s of [192, 512]) writeFileSync(`${dir}/icone-${s}.png`, png(s, cor));
}
