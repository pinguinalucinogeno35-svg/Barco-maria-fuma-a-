import { useState } from 'react';
import QRCode from 'qrcode';
import { gerarCodigo, Logo, urlDoQr, useAuth } from '@ac/shared';
import { sb } from '../env';

/** Gera lote de etiquetas em branco para imprimir; o tecnico cadastra o aparelho ao ler cada uma. */
export function Etiquetas() {
  const { session } = useAuth();
  const [qtd, setQtd] = useState('12');
  const [lote, setLote] = useState<{ codigo: string; png: string }[]>([]);
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState(false);

  const gerar = async (e: React.FormEvent) => {
    e.preventDefault(); setGerando(true); setErro('');
    const n = Math.min(Math.max(Number(qtd) || 1, 1), 100);
    const codigos = new Set<string>();
    while (codigos.size < n) codigos.add(gerarCodigo());
    const { error } = await sb.from('etiquetas').insert([...codigos].map((codigo) => ({ codigo, criada_por: session!.user.id })));
    if (error) { setErro('Erro ao gerar o lote. Tente de novo.'); setGerando(false); return; }
    const url = import.meta.env.VITE_TECNICO_URL;
    setLote(await Promise.all([...codigos].map(async (codigo) => ({
      codigo, png: await QRCode.toDataURL(urlDoQr(url, codigo), { errorCorrectionLevel: 'H', margin: 2, width: 320, color: { dark: '#072a69', light: '#ffffff' } }),
    }))));
    setGerando(false);
  };

  return (
    <>
      <form className="nao-imprime cartao" onSubmit={gerar}>
        <label>Quantas etiquetas em branco gerar? (1 a 100)
          <input type="number" min={1} max={100} value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </label>
        <p><small>O técnico lê a etiqueta colada no aparelho e cadastra os dados dele pelo celular.</small></p>
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={gerando}>{gerando ? 'Gerando…' : 'Gerar lote'}</button>
        {lote.length > 0 && <button type="button" style={{ marginTop: 8, width: '100%' }} onClick={() => window.print()}>Imprimir lote</button>}
      </form>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {lote.map((l) => (
          <div className="etiqueta" key={l.codigo} style={{ padding: 10 }}>
            <Logo largura={100} />
            <img src={l.png} alt={l.codigo} style={{ width: 130, height: 130, display: 'block', margin: '4px auto' }} />
            <div className="codigo" style={{ fontSize: '.85rem' }}>{l.codigo}</div>
          </div>
        ))}
      </div>
    </>
  );
}
