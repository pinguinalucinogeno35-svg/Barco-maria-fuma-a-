import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@ac/shared';
import { enfileirarEdicao, lerFicha, pendentesDoEquipamento, salvarFicha, type Ficha as FichaT, type Pendente } from '@ac/shared';
import { sb } from '../env';
import { useSync } from '../sync';

const TZ = 'America/Sao_Paulo';
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ }) : '—');
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const NOME_TIPO: Record<string, string> = { preventiva: 'Preventiva', corretiva: 'Corretiva', limpeza: 'Limpeza', instalacao: 'Instalação' };

export function Ficha() {
  const { codigo = '' } = useParams();
  const { fila } = useSync();
  const [ficha, setFicha] = useState<FichaT | null>(null);
  const [locais, setLocais] = useState<Pendente[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'inexistente' | 'sem-dados'>('carregando');
  const [doCache, setDoCache] = useState(false);
  const [editando, setEditando] = useState(false);
  const [modelo, setModelo] = useState('');
  const [local, setLocal] = useState('');
  const { perfil } = useAuth();

  const salvarEdicao = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const patch = { modelo: modelo.trim() || null, local_instalacao: local.trim() || null };
    await enfileirarEdicao(codigo, ficha!.equipamento.id, patch);
    setFicha({ ...ficha!, equipamento: { ...ficha!.equipamento, ...patch } });
    setEditando(false);
    dispatchEvent(new Event('ac-fila-mudou'));
  };

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
        {!e.modelo || !e.local_instalacao ? <p className="alerta">Falta informar {!e.modelo ? 'o modelo' : 'o local de instalação'}.</p> : null}
        {editando ? (
          <form onSubmit={salvarEdicao}>
            <label>Modelo<input value={modelo} onChange={(x) => setModelo(x.target.value)} /></label>
            <label>Local de instalação<input value={local} onChange={(x) => setLocal(x.target.value)} placeholder="Ex.: Sala 2, 3º andar" /></label>
            <button className="primario">Salvar</button>
          </form>
        ) : (
          <p><button onClick={() => { setModelo(e.modelo ?? ''); setLocal(e.local_instalacao ?? ''); setEditando(true); }}>Editar modelo e local</button></p>
        )}
        <p className={vencida ? 'alerta' : ''} style={{ marginBottom: 0 }}>
          Última: {dataBR(e.ultima_manutencao)} · Próxima: {dataBR(e.proxima_manutencao)}{vencida ? ' (vencida)' : ''}
        </p>
      </div>
      <Link to="nova"><button className="primario">Registrar manutenção</button></Link>
      <h3>Histórico</h3>
      <ul className="lista">
        {locais.map((p) => (
          <li key={p.id}><strong>{NOME_TIPO[p.tipo]}</strong> · {dataBR(p.executada_em)} às {horaBR(p.executada_em)} · {perfil?.nome}<br />{p.servico}<br /><span className="alerta">— aguardando envio{p.erro ? ` (erro: ${p.erro})` : ''}</span></li>
        ))}
        {historico.map((m) => (
          <li key={m.id}><strong>{NOME_TIPO[m.tipo]}</strong> · {dataBR(m.executada_em)} às {horaBR(m.executada_em)} · {m.tecnico_nome}<br />{m.servico}{m.observacoes ? <><br /><small>{m.observacoes}</small></> : null}</li>
        ))}
        {!historico.length && !locais.length && <li>Nenhuma manutenção registrada.</li>}
      </ul>
    </>
  );
}
