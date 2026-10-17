import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { EquipamentoStatus, Manutencao } from '@ac/shared';
import { sb } from '../env';

const TZ = 'America/Sao_Paulo';
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
const NOME_TIPO: Record<string, string> = { preventiva: 'Preventiva', corretiva: 'Corretiva', limpeza: 'Limpeza', instalacao: 'Instalação' };

export function Detalhe() {
  const { codigo = '' } = useParams();
  const [eq, setEq] = useState<(EquipamentoStatus & { clientes: { nome: string; telefone: string | null; endereco: string | null } | null }) | null>(null);
  const [hist, setHist] = useState<Manutencao[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('equipamentos_status').select('*, clientes(nome,telefone,endereco)').eq('codigo', codigo).maybeSingle();
      if (error || !data) { setEstado('erro'); return; }
      const { data: m } = await sb.from('manutencoes').select('*').eq('equipamento_id', data.id).order('executada_em', { ascending: false });
      setEq(data as any); setHist(m ?? []); setEstado('ok');
    })();
  }, [codigo]);

  if (estado === 'carregando') return <p>Carregando…</p>;
  if (estado === 'erro' || !eq) return <p className="erro">Equipamento não encontrado.</p>;
  return (
    <>
      <div className="cartao">
        <h2 style={{ margin: 0 }}>{eq.marca} {eq.modelo}{eq.btus ? ` · ${eq.btus} BTU` : ''}</h2>
        <p style={{ margin: '4px 0' }}>{eq.clientes?.nome} — {eq.local_instalacao ?? 'local não informado'}</p>
        <small>{eq.codigo} · Série {eq.numero_serie ?? '—'} · {eq.clientes?.telefone ?? ''} {eq.clientes?.endereco ?? ''}</small>
        <p style={{ marginBottom: 0 }}><Link to={`/e/${eq.codigo}/editar`}>Editar aparelho</Link> · <Link to={`/etiqueta/${eq.codigo}`}>Etiqueta QR</Link></p>
      </div>
      <h3>Histórico ({hist.length})</h3>
      <ul className="lista">
        {hist.map((m) => (
          <li key={m.id} className={m.cancelada_em ? 'cancelado' : ''}>
            <strong>{NOME_TIPO[m.tipo]}</strong> · {dataHora(m.executada_em)} · {m.tecnico_nome}<br />
            {m.servico}{m.observacoes ? <><br /><small>{m.observacoes}</small></> : null}<br /><Link to={`/servicos/${m.id}`}>Abrir / corrigir</Link>
          </li>
        ))}
        {!hist.length && <li>Nenhuma manutenção registrada.</li>}
      </ul>
    </>
  );
}
