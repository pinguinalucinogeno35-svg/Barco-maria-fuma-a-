import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sb } from '../env';
import { baixarCsv } from '../csv';

const TZ = 'America/Sao_Paulo';
const NOME_TIPO: Record<string, string> = { preventiva: 'Preventiva', corretiva: 'Corretiva', limpeza: 'Limpeza', instalacao: 'Instalação' };
const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ });
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const PAGINA = 1000, LIMITE = 20000;

interface Geral { aparelhos: number; vencidos: number; vencem_7: number; vencem_30: number; nunca_atendidos: number; servicos_mes: number; servicos_mes_anterior: number }
interface PorTecnico { tecnico_id: string; tecnico_nome: string; tipo: string; total: number }
interface Mes { mes: string; total: number }
interface VencidoCliente { cliente_id: string; cliente_nome: string; aparelhos: number; mais_antigo: string }

/** Le tudo em paginas de 1000 (limite do servidor) ate acabar ou chegar em LIMITE linhas. */
async function lerTudo<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; i < LIMITE; i += PAGINA) {
    const { data, error } = await pagina(i, i + PAGINA - 1);
    if (error) throw error;
    todas.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) break;
  }
  return todas;
}

function Cartao({ n, rotulo, alerta }: { n: number | string; rotulo: string; alerta?: boolean }) {
  return (
    <div className="cartao" style={{ flex: '1 1 130px', margin: 0, textAlign: 'center' }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: alerta ? 'var(--erro)' : 'var(--azul)' }}>{n}</div>
      <small>{rotulo}</small>
    </div>
  );
}

export function Relatorios() {
  const hoje = new Date();
  const [geral, setGeral] = useState<Geral | null>(null);
  const [meses, setMeses] = useState<Mes[]>([]);
  const [de, setDe] = useState(dia(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(dia(hoje));
  const [porTecnico, setPorTecnico] = useState<PorTecnico[]>([]);
  const [janela, setJanela] = useState(0);
  const [vencidos, setVencidos] = useState<VencidoCliente[]>([]);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState('');

  useEffect(() => {
    sb.rpc('resumo_geral').then(({ data, error }) => { if (error) setErro('Não foi possível carregar o resumo.'); else setGeral(data?.[0] ?? null); });
    sb.rpc('servicos_por_mes', { p_meses: 12 }).then(({ data }) => setMeses(data ?? []));
  }, []);
  useEffect(() => {
    if (!de || !ate || de > ate) return;
    sb.rpc('relatorio_servicos', { p_de: de, p_ate: ate }).then(({ data }) => setPorTecnico(data ?? []));
  }, [de, ate]);
  useEffect(() => {
    sb.rpc('resumo_vencidos', { p_dias: janela }).then(({ data }) => setVencidos(data ?? []));
  }, [janela]);

  // soma por funcionario, com o detalhe por tipo
  const tecnicos = [...porTecnico.reduce((m, r) => {
    const x = m.get(r.tecnico_id) ?? { nome: r.tecnico_nome, total: 0, tipos: {} as Record<string, number> };
    x.total += r.total; x.tipos[r.tipo] = r.total; m.set(r.tecnico_id, x); return m;
  }, new Map<string, { nome: string; total: number; tipos: Record<string, number> }>()).values()].sort((a, b) => b.total - a.total);
  const totalPeriodo = tecnicos.reduce((s, t) => s + t.total, 0);
  const maxMes = Math.max(1, ...meses.map((m) => m.total));

  const exportar = async (qual: 'servicos' | 'vencidos') => {
    setExportando(qual); setErro('');
    try {
      if (qual === 'servicos') {
        const lin = await lerTudo<any>((i, f) => sb.from('manutencoes')
          .select('executada_em,tecnico_nome,tipo,servico,observacoes,equipamentos(codigo,marca,modelo,local_instalacao,clientes(nome))')
          .is('cancelada_em', null).gte('executada_em', `${de}T00:00:00-03:00`).lte('executada_em', `${ate}T23:59:59-03:00`)
          .order('executada_em').order('id').range(i, f));
        baixarCsv(`servicos_${de}_a_${ate}.csv`, [
          ['Data', 'Hora', 'Funcionário', 'Tipo', 'Cliente', 'Aparelho', 'Código', 'Local', 'Serviço', 'Observações'],
          ...lin.map((m) => [dataBR(m.executada_em), horaBR(m.executada_em), m.tecnico_nome, NOME_TIPO[m.tipo], m.equipamentos?.clientes?.nome,
            `${m.equipamentos?.marca ?? ''} ${m.equipamentos?.modelo ?? ''}`.trim(), m.equipamentos?.codigo, m.equipamentos?.local_instalacao, m.servico, m.observacoes]),
        ]);
      } else {
        const limite = new Date(Date.now() + janela * 86400000).toISOString();
        const lin = await lerTudo<any>((i, f) => sb.from('equipamentos_status')
          .select('codigo,marca,modelo,local_instalacao,ultima_manutencao,proxima_manutencao,clientes!inner(nome,telefone,endereco)')
          .eq('ativo', true).lt('proxima_manutencao', limite).order('proxima_manutencao').order('id').range(i, f));
        baixarCsv(`aparelhos_${janela ? `vencem_em_${janela}_dias` : 'vencidos'}_${dia(new Date())}.csv`, [
          ['Cliente', 'Telefone', 'Endereço', 'Aparelho', 'Código', 'Local', 'Última manutenção', 'Próxima manutenção'],
          ...lin.map((e) => [e.clientes?.nome, e.clientes?.telefone, e.clientes?.endereco, `${e.marca} ${e.modelo ?? ''}`.trim(), e.codigo, e.local_instalacao,
            e.ultima_manutencao ? dataBR(e.ultima_manutencao) : 'nunca', dataBR(e.proxima_manutencao)]),
        ]);
      }
    } catch { setErro('Não foi possível gerar a planilha. Tente de novo.'); }
    setExportando('');
  };

  const variacao = geral && geral.servicos_mes_anterior > 0
    ? Math.round(((geral.servicos_mes - geral.servicos_mes_anterior) / geral.servicos_mes_anterior) * 100) : null;

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      <span className="etiqueta-topico">Visão geral</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '10px 0' }}>
        <Cartao n={geral?.aparelhos ?? '—'} rotulo="aparelhos ativos" />
        <Cartao n={geral?.vencidos ?? '—'} rotulo="manutenção vencida" alerta={!!geral?.vencidos} />
        <Cartao n={geral?.vencem_7 ?? '—'} rotulo="vencem em 7 dias" />
        <Cartao n={geral?.vencem_30 ?? '—'} rotulo="vencem em 30 dias" />
        <Cartao n={geral?.servicos_mes ?? '—'} rotulo={variacao == null ? 'serviços no mês' : `serviços no mês (${variacao >= 0 ? '+' : ''}${variacao}% vs. anterior)`} />
        <Cartao n={geral?.nunca_atendidos ?? '—'} rotulo="nunca atendidos" />
      </div>

      <div className="cartao">
        <span className="etiqueta-topico">Serviços por mês</span>
        <div role="img" aria-label="Serviços por mês nos últimos 12 meses" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130, marginTop: 12 }}>
          {meses.map((m) => (
            <div key={m.mes} style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
              <small style={{ fontSize: '.65rem' }}>{m.total || ''}</small>
              <div style={{ height: `${(m.total / maxMes) * 90}px`, minHeight: m.total ? 3 : 1, background: m.total ? 'var(--azul)' : 'var(--borda)', borderRadius: '4px 4px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {meses.map((m) => <small key={m.mes} style={{ flex: 1, textAlign: 'center', fontSize: '.6rem' }}>{new Date(m.mes + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small>)}
        </div>
      </div>

      <div className="cartao">
        <span className="etiqueta-topico">Serviços por funcionário</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label style={{ flex: 1 }}>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        </div>
        {de > ate && <p className="erro">A data inicial é depois da final.</p>}
        <ul className="lista">
          {tecnicos.map((t) => (
            <li key={t.nome}>
              <div className="linha-acoes" style={{ justifyContent: 'space-between' }}><strong>{t.nome}</strong><strong>{t.total}</strong></div>
              <small>{Object.entries(t.tipos).map(([k, v]) => `${NOME_TIPO[k]}: ${v}`).join(' · ')}</small>
            </li>
          ))}
          {!tecnicos.length && <li>Nenhum serviço neste período.</li>}
        </ul>
        {tecnicos.length > 0 && <p style={{ margin: '4px 0' }}><small>Total no período: <strong>{totalPeriodo}</strong></small></p>}
        <button disabled={exportando !== '' || de > ate} onClick={() => exportar('servicos')}>{exportando === 'servicos' ? 'Gerando…' : 'Baixar planilha dos serviços'}</button>
      </div>

      <div className="cartao">
        <span className="etiqueta-topico">Manutenções a fazer, por cliente</span>
        <label>Mostrar
          <select value={janela} onChange={(e) => setJanela(Number(e.target.value))}>
            <option value={0}>Só as vencidas</option><option value={7}>Vencidas + próximos 7 dias</option><option value={30}>Vencidas + próximos 30 dias</option>
          </select>
        </label>
        <ul className="lista">
          {vencidos.map((c) => (
            <li key={c.cliente_id}>
              <div className="linha-acoes" style={{ justifyContent: 'space-between' }}><strong>{c.cliente_nome}</strong><span className="selo inativo">{c.aparelhos} aparelho(s)</span></div>
              <small>Mais antiga: {dataBR(c.mais_antigo)}</small>
            </li>
          ))}
          {!vencidos.length && <li>Nenhum aparelho nesta situação.</li>}
        </ul>
        <div className="linha-acoes">
          <button disabled={exportando !== '' || !vencidos.length} onClick={() => exportar('vencidos')}>{exportando === 'vencidos' ? 'Gerando…' : 'Baixar planilha dos aparelhos'}</button>
          <Link to="/">Ver na lista de aparelhos</Link>
        </div>
      </div>
    </>
  );
}
