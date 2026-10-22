import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Fotos, ITENS_CHECKLIST, useAuth, type Manutencao, type TipoManutencao } from '@ac/shared';
import { sb } from '../env';

const paraInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export function ServicoEditar() {
  const { id } = useParams();
  const nav = useNavigate();
  const { session } = useAuth();
  const [m, setM] = useState<(Manutencao & { equipamentos: { codigo: string } | null }) | null>(null);
  const [tipo, setTipo] = useState<TipoManutencao>('preventiva');
  const [servico, setServico] = useState('');
  const [obs, setObs] = useState('');
  const [quando, setQuando] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    sb.from('manutencoes').select('*, equipamentos(codigo)').eq('id', id!).single().then(({ data }) => {
      if (!data) return;
      const x = data as any; setM(x); setTipo(x.tipo); setServico(x.servico); setObs(x.observacoes ?? ''); setQuando(paraInput(x.executada_em));
    });
  }, [id]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro('');
    const { error } = await sb.from('manutencoes').update({ tipo, servico: servico.trim(), observacoes: obs.trim() || null, executada_em: new Date(quando).toISOString() }).eq('id', id!);
    if (error) setErro('Erro ao salvar.'); else nav(-1);
  };
  const cancelar = async () => {
    if (!motivo.trim()) { setErro('Informe o motivo do cancelamento.'); return; }
    const { error } = await sb.from('manutencoes').update({ cancelada_em: new Date().toISOString(), cancelada_motivo: motivo.trim() }).eq('id', id!);
    if (error) setErro('Erro ao cancelar.'); else nav(-1);
  };

  if (!m) return <p>Carregando…</p>;
  const cancelado = !!m.cancelada_em;
  return (
    <form onSubmit={salvar}>
      <h2>Serviço</h2>
      <p>{m.tecnico_nome} · <Link to={`/e/${m.equipamentos?.codigo}`}>{m.equipamentos?.codigo}</Link>
        {m.editada_em && <><br /><small>Última correção: {new Date(m.editada_em).toLocaleString('pt-BR')}</small></>}</p>
      {cancelado && <p className="erro">Cancelado: {m.cancelada_motivo}</p>}
      <label>Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoManutencao)} disabled={cancelado}>
          <option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option>
          <option value="limpeza">Limpeza</option><option value="instalacao">Instalação</option>
        </select>
      </label>
      <label>Serviço realizado<textarea rows={3} value={servico} onChange={(e) => setServico(e.target.value)} required disabled={cancelado} /></label>
      <label>Data e hora<input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} required disabled={cancelado} /></label>
      <label>Observações<textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} disabled={cancelado} /></label>
      <div className="cartao">
        <small>Checklist: {ITENS_CHECKLIST.filter((i) => m.checklist[i.chave]).map((i) => i.rotulo).join(', ') || 'nenhum item marcado'}</small>
      </div>
      <Fotos caminhos={m.fotos} />
      {erro && <p className="erro">{erro}</p>}
      {!cancelado && (
        <>
          <button className="primario">Salvar correção</button>
          <div className="cartao">
            <label>Motivo para cancelar este serviço<input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: lançado no aparelho errado" /></label>
            <button type="button" onClick={cancelar} style={{ color: 'var(--erro)' }}>Cancelar serviço</button>
            <p><small>O serviço cancelado fica guardado, mas não conta nas somas nem na próxima manutenção.</small></p>
          </div>
        </>
      )}
    </form>
  );
}
