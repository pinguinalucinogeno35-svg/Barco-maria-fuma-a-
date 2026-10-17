import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Manutencao } from '@ac/shared';
import { sb } from '../env';

type Linha = Manutencao & { equipamentos: { codigo: string; marca: string; modelo: string | null; local_instalacao: string | null; clientes: { nome: string } | null } | null };
interface Resumo { tecnico_id: string; tecnico_nome: string; mes: string; total: number }
const TZ = 'America/Sao_Paulo';
const TAM = 30;
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
const NOME_TIPO: Record<string, string> = { preventiva: 'Preventiva', corretiva: 'Corretiva', limpeza: 'Limpeza', instalacao: 'Instalação' };
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

export function Servicos() {
  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string }[]>([]);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [tecnico, setTecnico] = useState('');
  const [tipo, setTipo] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [canceladas, setCanceladas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    sb.from('perfis').select('id,nome').order('nome').then(({ data }) => setTecnicos(data ?? []));
    sb.from('resumo_servicos').select('*').eq('mes', mesAtual()).order('total', { ascending: false }).then(({ data }) => setResumo(data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      let q = sb.from('manutencoes').select('*, equipamentos(codigo,marca,modelo,local_instalacao,clientes(nome))', { count: 'exact' })
        .order('executada_em', { ascending: false }).range(pagina * TAM, pagina * TAM + TAM - 1);
      q = canceladas ? q.not('cancelada_em', 'is', null) : q.is('cancelada_em', null);
      if (tecnico) q = q.eq('tecnico_id', tecnico);
      if (tipo) q = q.eq('tipo', tipo);
      // datas escolhidas valem no horario de Brasilia (UTC-3)
      if (de) q = q.gte('executada_em', `${de}T00:00:00-03:00`);
      if (ate) q = q.lte('executada_em', `${ate}T23:59:59-03:00`);
      const { data, error, count } = await q;
      if (error) { setErro('Não foi possível carregar os serviços.'); return; }
      setErro(''); setLinhas(data as unknown as Linha[]); setTotal(count);
    })();
  }, [tecnico, tipo, de, ate, canceladas, pagina]);

  const filtro = <T,>(set: (v: T) => void) => (e: { target: { value: string } }) => { set(e.target.value as T); setPagina(0); };

  return (
    <>
      <div className="cartao">
        <span className="etiqueta-topico">Serviços no mês</span>
        <ul className="lista">
          {resumo.map((r) => <li key={r.tecnico_id}><strong>{r.tecnico_nome}</strong> — {r.total}</li>)}
          {!resumo.length && <li>Nenhum serviço neste mês.</li>}
        </ul>
      </div>
      <div className="cartao">
        <label>Funcionário
          <select value={tecnico} onChange={filtro(setTecnico)}><option value="">Todos</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
        </label>
        <label>Tipo
          <select value={tipo} onChange={filtro(setTipo)}><option value="">Todos</option>{Object.entries(NOME_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>De<input type="date" value={de} onChange={filtro(setDe)} /></label>
          <label style={{ flex: 1 }}>Até<input type="date" value={ate} onChange={filtro(setAte)} /></label>
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 22, height: 22, minHeight: 0, margin: 0 }} checked={canceladas} onChange={(e) => { setCanceladas(e.target.checked); setPagina(0); }} />
          Ver só os cancelados
        </label>
      </div>
      <p><strong>{total ?? '…'}</strong> serviço(s) encontrado(s)</p>
      {erro && <p className="erro">{erro}</p>}
      <ul className="lista">
        {linhas.map((m) => (
          <li key={m.id} className={m.cancelada_em ? 'cancelado' : ''}>
            <strong>{NOME_TIPO[m.tipo]}</strong> · {dataHora(m.executada_em)} · {m.tecnico_nome}<br />
            {m.equipamentos && <>{m.equipamentos.marca} {m.equipamentos.modelo} · {m.equipamentos.clientes?.nome}{m.equipamentos.local_instalacao ? ` — ${m.equipamentos.local_instalacao}` : ''}<br /></>}
            {m.servico}{m.cancelada_motivo ? <><br /><small>Cancelado: {m.cancelada_motivo}</small></> : null}<br />
            <Link to={`/servicos/${m.id}`}>Abrir / corrigir</Link>
          </li>
        ))}
        {!linhas.length && <li>Nenhum serviço encontrado.</li>}
      </ul>
      <div className="linha-acoes">
        <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <button disabled={linhas.length < TAM} onClick={() => setPagina(pagina + 1)}>Próxima</button>
      </div>
    </>
  );
}
