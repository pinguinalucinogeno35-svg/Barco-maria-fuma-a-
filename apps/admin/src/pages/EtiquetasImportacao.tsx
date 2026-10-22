import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Logo, urlDoQr } from '@ac/shared';
import { sb } from '../env';

const POR_PAGINA = 60;
interface Item { codigo: string; cliente: string; local: string | null; svg: string }

/** Etiquetas de um lote importado: QR + codigo + cliente + local, 60 por pagina para imprimir. */
export function EtiquetasImportacao() {
  const { id = '' } = useParams();
  const [ids, setIds] = useState<string[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    sb.from('importacoes').select('equipamento_ids,desfeita_em').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) setErro('Importação não encontrada.'); else setIds(data.desfeita_em ? [] : data.equipamento_ids);
    });
  }, [id]);

  useEffect(() => {
    if (!ids) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const parte = ids.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
      const { data, error } = await sb.from('equipamentos').select('id,codigo,local_instalacao,clientes(nome)').in('id', parte);
      if (!vivo) return;
      if (error) { setErro('Não foi possível carregar as etiquetas.'); setCarregando(false); return; }
      const porId = new Map((data as any[]).map((e) => [e.id, e]));
      const url = import.meta.env.VITE_TECNICO_URL;
      const prontos = await Promise.all(parte.filter((i) => porId.has(i)).map(async (i) => {
        const e = porId.get(i);
        const svg = await QRCode.toString(urlDoQr(url, e.codigo), { type: 'svg', errorCorrectionLevel: 'H', margin: 1, color: { dark: '#072a69', light: '#ffffff' } });
        return { codigo: e.codigo, cliente: e.clientes?.nome ?? '', local: e.local_instalacao, svg } as Item;
      }));
      if (vivo) { setItens(prontos); setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [ids, pagina]);

  if (erro) return <p className="erro">{erro}</p>;
  if (!ids) return <p>Carregando…</p>;
  const paginas = Math.max(1, Math.ceil(ids.length / POR_PAGINA));

  return (
    <>
      <div className="nao-imprime cartao">
        <Link to="/importar">← Voltar à importação</Link>
        <p><strong>{ids.length}</strong> etiqueta(s) neste lote · página {pagina + 1} de {paginas}</p>
        <div className="linha-acoes">
          <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <button disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima</button>
          <button className="primario" style={{ width: 'auto' }} disabled={carregando} onClick={() => window.print()}>Imprimir esta página</button>
        </div>
        <small>Imprima uma página por vez. A ordem segue a da planilha, então as etiquetas de um mesmo cliente saem juntas.</small>
      </div>
      {carregando ? <p className="nao-imprime">Gerando QR Codes…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {itens.map((e) => (
            <div className="etiqueta" key={e.codigo} style={{ padding: 10 }}>
              <Logo largura={90} subtitulo={false} />
              <div style={{ width: 130, margin: '2px auto' }} dangerouslySetInnerHTML={{ __html: e.svg }} />
              <div className="codigo" style={{ fontSize: '.85rem' }}>{e.codigo}</div>
              <small style={{ display: 'block', fontSize: '.7rem', lineHeight: 1.2 }}>{e.cliente}{e.local ? ` — ${e.local}` : ''}</small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
