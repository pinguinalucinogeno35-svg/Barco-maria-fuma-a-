import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { enfileirarEquipamento, lerClientes, salvarClientes, useAuth, type Cliente } from '@ac/shared';
import { sb } from '../env';
import { useSync } from '../sync';

export function CadastrarEquipamento() {
  const { codigo = '' } = useParams();
  const { session } = useAuth();
  const { online } = useSync();
  const nav = useNavigate();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [f, setF] = useState({ cliente_id: '', marca: '', modelo: '', btus: '', serie: '', local: '', instalacao: '', periodicidade: '30' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    (async () => {
      setClientes(await lerClientes()); // lista salva no celular: funciona sem sinal
      const { data, error } = await sb.from('clientes').select('id,nome,documento,telefone,endereco').order('nome').limit(5000);
      if (!error && data) { await salvarClientes(data); setClientes(data); }
    })();
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const cliente = clientes?.find((c) => c.id === f.cliente_id);
    if (!cliente) { setErro('Escolha o cliente.'); return; }
    setSalvando(true);
    await enfileirarEquipamento({
      id: crypto.randomUUID(), codigo, cliente_id: cliente.id, local_instalacao: f.local.trim() || null,
      marca: f.marca.trim(), modelo: f.modelo.trim() || null, btus: f.btus ? Number(f.btus) : null,
      numero_serie: f.serie.trim() || null, data_instalacao: f.instalacao || null,
      periodicidade_dias: Number(f.periodicidade) || 30,
    }, session!.user.id, cliente.nome);
    dispatchEvent(new Event('ac-fila-mudou'));
    nav(`/e/${codigo}/nova`, { replace: true }); // segue direto para lancar o servico
  };

  return (
    <form onSubmit={salvar}>
      <h2>Cadastrar aparelho</h2>
      <small>Etiqueta {codigo}</small>
      <label>Cliente
        <select value={f.cliente_id} onChange={set('cliente_id')} required>
          <option value="">Selecione…</option>
          {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      {clientes && !clientes.length && (
        <p className="alerta">{online ? 'Nenhum cliente cadastrado ainda. Peça à administração para cadastrar o cliente.' : 'Lista de clientes ainda não foi baixada neste celular. Conecte-se uma vez para baixá-la.'}</p>
      )}
      <label>Marca<input value={f.marca} onChange={set('marca')} required /></label>
      <label>Modelo<input value={f.modelo} onChange={set('modelo')} /></label>
      <label>Local de instalação<input value={f.local} onChange={set('local')} placeholder="Ex.: Sala 2, 3º andar" /></label>
      <label>BTUs<input type="number" inputMode="numeric" value={f.btus} onChange={set('btus')} /></label>
      <label>Número de série<input value={f.serie} onChange={set('serie')} /></label>
      <label>Data de instalação<input type="date" value={f.instalacao} onChange={set('instalacao')} /></label>
      <label>Manutenção a cada (dias)<input type="number" inputMode="numeric" min={1} value={f.periodicidade} onChange={set('periodicidade')} /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar e lançar serviço'}</button>
    </form>
  );
}
