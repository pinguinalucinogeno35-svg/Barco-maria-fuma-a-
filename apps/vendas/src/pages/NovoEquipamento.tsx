import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gerarCodigo, useAuth } from '@ac/shared';
import { sb } from '../env';

export function NovoEquipamento() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [f, setF] = useState({ cliente: '', telefone: '', endereco: '', local: '', marca: '', modelo: '', btus: '', serie: '', instalacao: '', periodicidade: '30' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true); setErro('');
    const { data: cli, error: e1 } = await sb.from('clientes')
      .insert({ nome: f.cliente, telefone: f.telefone || null, endereco: f.endereco || null }).select('id').single();
    if (e1) { setErro('Erro ao salvar cliente.'); setSalvando(false); return; }
    // colisao de codigo e improvavel (31^8), mas o unique garante: tenta de novo
    for (let i = 0; i < 3; i++) {
      const codigo = gerarCodigo();
      const { error } = await sb.from('equipamentos').insert({
        codigo, cliente_id: cli.id, local_instalacao: f.local || null, marca: f.marca, modelo: f.modelo || null,
        btus: f.btus ? Number(f.btus) : null, numero_serie: f.serie || null, data_instalacao: f.instalacao || null,
        periodicidade_dias: Number(f.periodicidade) || 30, criado_por: session!.user.id,
      });
      if (!error) { nav(`/etiqueta/${codigo}`); return; }
      if (error.code !== '23505') break;
    }
    setErro('Erro ao salvar equipamento.'); setSalvando(false);
  };

  return (
    <form onSubmit={salvar}>
      <h2>Novo equipamento</h2>
      <label>Cliente<input value={f.cliente} onChange={set('cliente')} required /></label>
      <label>Telefone<input type="tel" value={f.telefone} onChange={set('telefone')} /></label>
      <label>Endereço<input value={f.endereco} onChange={set('endereco')} /></label>
      <label>Local de instalação (ex.: Sala 2)<input value={f.local} onChange={set('local')} /></label>
      <label>Marca<input value={f.marca} onChange={set('marca')} required /></label>
      <label>Modelo<input value={f.modelo} onChange={set('modelo')} /></label>
      <label>BTUs<input type="number" inputMode="numeric" value={f.btus} onChange={set('btus')} /></label>
      <label>Número de série<input value={f.serie} onChange={set('serie')} /></label>
      <label>Data de instalação<input type="date" value={f.instalacao} onChange={set('instalacao')} /></label>
      <label>Manutenção a cada (dias)<input type="number" inputMode="numeric" min={1} value={f.periodicidade} onChange={set('periodicidade')} /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar e gerar QR'}</button>
    </form>
  );
}
