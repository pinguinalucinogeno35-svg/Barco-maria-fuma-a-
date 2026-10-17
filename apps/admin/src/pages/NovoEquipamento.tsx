import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { gerarCodigo, useAuth, type Cliente } from '@ac/shared';
import { sb } from '../env';

/** Cadastra um aparelho novo (gera a etiqueta) ou, com :codigo na rota, edita um existente. */
export function NovoEquipamento() {
  const { codigo: codigoEdicao } = useParams();
  const nav = useNavigate();
  const { session } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [idEdicao, setIdEdicao] = useState<string | null>(null);
  const [f, setF] = useState({ cliente_id: '', local: '', marca: '', modelo: '', btus: '', serie: '', instalacao: '', periodicidade: '30' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    sb.from('clientes').select('*').order('nome').limit(5000).then(({ data }) => setClientes(data ?? []));
    if (!codigoEdicao) return;
    sb.from('equipamentos').select('*').eq('codigo', codigoEdicao).single().then(({ data: e }) => {
      if (!e) return;
      setIdEdicao(e.id);
      setF({ cliente_id: e.cliente_id, local: e.local_instalacao ?? '', marca: e.marca, modelo: e.modelo ?? '', btus: e.btus?.toString() ?? '',
        serie: e.numero_serie ?? '', instalacao: e.data_instalacao ?? '', periodicidade: String(e.periodicidade_dias) });
    });
  }, [codigoEdicao]);

  const campos = () => ({
    cliente_id: f.cliente_id, local_instalacao: f.local.trim() || null, marca: f.marca.trim(), modelo: f.modelo.trim() || null,
    btus: f.btus ? Number(f.btus) : null, numero_serie: f.serie.trim() || null, data_instalacao: f.instalacao || null,
    periodicidade_dias: Number(f.periodicidade) || 30,
  });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true); setErro('');
    if (codigoEdicao) {
      const { error } = await sb.from('equipamentos').update(campos()).eq('id', idEdicao!);
      if (error) { setErro('Erro ao salvar.'); setSalvando(false); } else nav(`/e/${codigoEdicao}`);
      return;
    }
    // colisao de codigo e improvavel (31^8), mas a chave primaria garante: tenta de novo
    for (let i = 0; i < 3; i++) {
      const codigo = gerarCodigo();
      const { error: e1 } = await sb.from('etiquetas').insert({ codigo, criada_por: session!.user.id });
      if (e1) { if (e1.code === '23505') continue; break; }
      const { error } = await sb.from('equipamentos').insert({ codigo, criado_por: session!.user.id, ...campos() });
      if (!error) { nav(`/etiqueta/${codigo}`); return; }
      break;
    }
    setErro('Erro ao salvar o aparelho.'); setSalvando(false);
  };

  return (
    <form onSubmit={salvar}>
      <h2>{codigoEdicao ? `Editar ${codigoEdicao}` : 'Novo aparelho'}</h2>
      <label>Cliente
        <select value={f.cliente_id} onChange={set('cliente_id')} required>
          <option value="">Selecione…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      {!clientes.length && <p className="alerta">Cadastre o cliente primeiro na aba Clientes.</p>}
      <label>Marca<input value={f.marca} onChange={set('marca')} required /></label>
      <label>Modelo<input value={f.modelo} onChange={set('modelo')} /></label>
      <label>Local de instalação<input value={f.local} onChange={set('local')} /></label>
      <label>BTUs<input type="number" inputMode="numeric" value={f.btus} onChange={set('btus')} /></label>
      <label>Número de série<input value={f.serie} onChange={set('serie')} /></label>
      <label>Data de instalação<input type="date" value={f.instalacao} onChange={set('instalacao')} /></label>
      <label>Manutenção a cada (dias)<input type="number" inputMode="numeric" min={1} value={f.periodicidade} onChange={set('periodicidade')} /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : codigoEdicao ? 'Salvar' : 'Salvar e gerar QR'}</button>
    </form>
  );
}
