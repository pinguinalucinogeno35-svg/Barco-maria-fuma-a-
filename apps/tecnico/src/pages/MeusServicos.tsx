import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pendentes, useAuth, type Manutencao, type Pendente } from '@ac/shared';
import { sb } from '../env';
import { useSync } from '../sync';

type Linha = Manutencao & { equipamentos: { codigo: string; marca: string; modelo: string | null; local_instalacao: string | null; clientes: { nome: string } | null } | null };
const TZ = 'America/Sao_Paulo';
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
const NOME_TIPO: Record<string, string> = { preventiva: 'Preventiva', corretiva: 'Corretiva', limpeza: 'Limpeza', instalacao: 'Instalação' };

export function MeusServicos() {
  const { session } = useAuth();
  const { fila } = useSync();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [contagem, setContagem] = useState<{ hoje: number; mes: number; total: number } | null>(null);
  const [locais, setLocais] = useState<Pendente[]>([]);
  const [erro, setErro] = useState('');
  const eu = session!.user.id;

  useEffect(() => {
    pendentes().then(setLocais);
    (async () => {
      const agora = new Date();
      const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
      const base = () => sb.from('manutencoes').select('id', { count: 'exact', head: true }).eq('tecnico_id', eu).is('cancelada_em', null);
      const [h, m, t, lista] = await Promise.all([
        base().gte('executada_em', inicioDia), base().gte('executada_em', inicioMes), base(),
        sb.from('manutencoes').select('*, equipamentos(codigo,marca,modelo,local_instalacao,clientes(nome))')
          .eq('tecnico_id', eu).is('cancelada_em', null).order('executada_em', { ascending: false }).limit(100),
      ]);
      if (lista.error) { setErro('Sem conexão: mostrando só o que ainda não foi enviado.'); return; }
      setErro(''); setContagem({ hoje: h.count ?? 0, mes: m.count ?? 0, total: t.count ?? 0 });
      setLinhas(lista.data as unknown as Linha[]);
    })();
  }, [eu, fila]);

  const Num = ({ n, rotulo }: { n: number | string; rotulo: string }) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--azul)' }}>{n}</div><small>{rotulo}</small>
    </div>
  );

  return (
    <>
      <h2>Meus serviços</h2>
      <div className="cartao" style={{ display: 'flex' }}>
        <Num n={contagem?.hoje ?? '—'} rotulo="hoje" /><Num n={contagem?.mes ?? '—'} rotulo="no mês" /><Num n={contagem?.total ?? '—'} rotulo="no total" />
      </div>
      {erro && <p className="alerta">{erro}</p>}
      <ul className="lista">
        {locais.map((p) => (
          <li key={p.id}><strong>{NOME_TIPO[p.tipo]}</strong> · {dataHora(p.executada_em)}<br />{p.servico}<br /><span className="alerta">aguardando envio{p.erro ? ` (erro: ${p.erro})` : ''}</span></li>
        ))}
        {linhas.map((m) => (
          <li key={m.id}>
            <strong>{NOME_TIPO[m.tipo]}</strong> · {dataHora(m.executada_em)}<br />
            {m.equipamentos && <><Link to={`/e/${m.equipamentos.codigo}`}>{m.equipamentos.marca} {m.equipamentos.modelo}</Link> · {m.equipamentos.clientes?.nome}{m.equipamentos.local_instalacao ? ` — ${m.equipamentos.local_instalacao}` : ''}<br /></>}
            {m.servico}{m.observacoes ? <><br /><small>{m.observacoes}</small></> : null}
          </li>
        ))}
        {!linhas.length && !locais.length && <li>Nenhum serviço registrado ainda.</li>}
      </ul>
    </>
  );
}
