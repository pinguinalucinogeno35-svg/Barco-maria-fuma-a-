import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Cliente } from '@ac/shared';
import { sb } from '../env';

export function Clientes() {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<Cliente[]>([]);
  const [erro, setErro] = useState('');
  useEffect(() => {
    const t = setTimeout(async () => {
      let q = sb.from('clientes').select('*').order('nome').limit(100);
      const termo = busca.trim().replace(/[,()%]/g, '');
      if (termo) q = q.or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%,documento.ilike.%${termo}%`);
      const { data, error } = await q;
      if (error) setErro('Não foi possível carregar os clientes.'); else { setErro(''); setLista(data); }
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);
  return (
    <>
      <div className="linha-acoes" style={{ marginBottom: 8 }}>
        <input type="search" style={{ flex: 1, marginTop: 0 }} placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Link to="/clientes/novo"><button className="primario" style={{ width: 'auto' }}>+ Cliente</button></Link>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <ul className="lista">
        {lista.map((c) => (
          <li key={c.id}><Link to={`/clientes/${c.id}`}><strong>{c.nome}</strong></Link><br /><small>{c.telefone} {c.endereco}</small></li>
        ))}
        {!lista.length && <li>Nenhum cliente encontrado.</li>}
      </ul>
    </>
  );
}

export function ClienteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState({ nome: '', documento: '', telefone: '', endereco: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!id) return;
    sb.from('clientes').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setF({ nome: data.nome, documento: data.documento ?? '', telefone: data.telefone ?? '', endereco: data.endereco ?? '' });
    });
  }, [id]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvando(true); setErro('');
    const dados = { nome: f.nome.trim(), documento: f.documento.trim() || null, telefone: f.telefone.trim() || null, endereco: f.endereco.trim() || null };
    const { error } = id ? await sb.from('clientes').update(dados).eq('id', id) : await sb.from('clientes').insert(dados);
    if (error) { setErro('Erro ao salvar o cliente.'); setSalvando(false); } else nav('/clientes');
  };

  return (
    <form onSubmit={salvar}>
      <h2>{id ? 'Editar cliente' : 'Novo cliente'}</h2>
      <label>Nome<input value={f.nome} onChange={set('nome')} required /></label>
      <label>CPF / CNPJ<input value={f.documento} onChange={set('documento')} /></label>
      <label>Telefone<input type="tel" value={f.telefone} onChange={set('telefone')} /></label>
      <label>Endereço<input value={f.endereco} onChange={set('endereco')} /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
    </form>
  );
}
