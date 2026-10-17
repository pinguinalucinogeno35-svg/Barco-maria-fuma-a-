import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { lerFicha, pendentesDoEquipamento, salvarFicha, type Ficha as FichaT, type Pendente } from '@ac/shared';
import { sb } from '../env';
import { useSync } from '../sync';

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export function Ficha() {
  const { codigo = '' } = useParams();
  const { fila } = useSync();
  const [ficha, setFicha] = useState<FichaT | null>(null);
  const [locais, setLocais] = useState<Pendente[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'inexistente' | 'sem-dados'>('carregando');
  const [doCache, setDoCache] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await sb.from('equipamentos_status').select('*, clientes(nome)').eq('codigo', codigo).maybeSingle();
      if (!vivo) return;
      if (!error && !data) { setEstado('inexistente'); return; }
      if (!error && data) {
        const { data: hist } = await sb.from('manutencoes').select('*').eq('equipamento_id', data.id)
          .order('executada_em', { ascending: false }).limit(50);
        const { clientes, ...equipamento } = data as any;
        const nova = { equipamento, cliente_nome: clientes?.nome ?? '', historico: hist ?? [] };
        await salvarFicha(codigo, nova);
        if (!vivo) return;
        setFicha({ ...nova, salvo_em: Date.now() }); setDoCache(false); setEstado('ok');
        return;
      }
      const cache = await lerFicha(codigo); // sem rede: usa a ultima copia salva
      if (!vivo) return;
      if (cache) { setFicha(cache); setDoCache(true); setEstado('ok'); } else setEstado('sem-dados');
    })();
    return () => { vivo = false; };
  }, [codigo, fila]);

  useEffect(() => {
    if (ficha) pendentesDoEquipamento(ficha.equipamento.id).then(setLocais);
  }, [ficha, fila]);

  if (estado === 'carregando') return <p>Carregando…</p>;
  if (estado === 'inexistente') return <p className="erro">Equipamento {codigo} não cadastrado.</p>;
  if (estado === 'sem-dados') return <p className="erro">Sem internet e este equipamento nunca foi aberto neste celular.</p>;
  const { equipamento: e, cliente_nome, historico } = ficha!;
  const vencida = e.proxima_manutencao && new Date(e.proxima_manutencao) < new Date();

  return (
    <>
      {doCache && <p className="alerta">Dados salvos no celular (podem estar desatualizados).</p>}
      <div className="cartao">
        <h2 style={{ margin: 0 }}>{e.marca} {e.modelo} {e.btus ? `· ${e.btus} BTU` : ''}</h2>
        <p style={{ margin: '4px 0' }}>{cliente_nome}{e.local_instalacao ? ` — ${e.local_instalacao}` : ''}</p>
        <small>{e.codigo} · Série {e.numero_serie ?? '—'}</small>
        <p className={vencida ? 'alerta' : ''} style={{ marginBottom: 0 }}>
          Última: {dataBR(e.ultima_manutencao)} · Próxima: {dataBR(e.proxima_manutencao)}{vencida ? ' (vencida)' : ''}
        </p>
      </div>
      <Link to="nova"><button className="primario">Registrar manutenção</button></Link>
      <h3>Histórico</h3>
      <ul className="lista">
        {locais.map((p) => (
          <li key={p.id}><strong>{p.tipo}</strong> · {dataBR(p.executada_em)} <span className="alerta">— aguardando envio{p.erro ? ` (erro: ${p.erro})` : ''}</span></li>
        ))}
        {historico.map((m) => (
          <li key={m.id}><strong>{m.tipo}</strong> · {dataBR(m.executada_em)}{m.observacoes ? <><br />{m.observacoes}</> : null}</li>
        ))}
        {!historico.length && !locais.length && <li>Nenhuma manutenção registrada.</li>}
      </ul>
    </>
  );
}
