import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EquipamentoStatus } from '@ac/shared';
import { sb } from '../env';

type Linha = EquipamentoStatus & { clientes: { nome: string } | null };
const TAM_PAGINA = 30;

export function Lista() {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    // espera o fim da digitacao; busca e paginacao no servidor (5 mil+ aparelhos)
    const t = setTimeout(async () => {
      let q = sb.from('equipamentos_status').select('*, clientes!inner(nome)')
        .order('criado_em', { ascending: false }).range(pagina * TAM_PAGINA, pagina * TAM_PAGINA + TAM_PAGINA - 1);
      const termo = busca.trim().replace(/[,()%]/g, '');
      if (termo) q = q.or(`codigo.ilike.%${termo}%,marca.ilike.%${termo}%,numero_serie.ilike.%${termo}%`);
      const { data, error } = await q;
      if (error) setErro('Não foi possível carregar a lista.'); else { setErro(''); setLinhas(data as unknown as Linha[]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busca, pagina]);

  return (
    <>
      <input type="search" placeholder="Buscar por código, marca ou série" value={busca}
        onChange={(e) => { setBusca(e.target.value); setPagina(0); }} />
      {erro && <p className="erro">{erro}</p>}
      <ul className="lista">
        {linhas.map((e) => (
          <li key={e.id}>
            <strong>{e.marca} {e.modelo}</strong> · {e.clientes?.nome}<br />
            <small>{e.codigo} · {e.local_instalacao ?? 'sem local'}</small>{' '}
            <Link to={`/etiqueta/${e.codigo}`}>Etiqueta QR</Link>
          </li>
        ))}
        {!linhas.length && <li>Nenhum equipamento encontrado.</li>}
      </ul>
      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <button disabled={linhas.length < TAM_PAGINA} onClick={() => setPagina(pagina + 1)}>Próxima</button>
      </div>
    </>
  );
}
