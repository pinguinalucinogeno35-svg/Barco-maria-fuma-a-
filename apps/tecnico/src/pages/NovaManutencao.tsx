import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { comprimirImagem, enfileirar, ITENS_CHECKLIST, lerFicha, useAuth, type Checklist, type TipoManutencao } from '@ac/shared';

export function NovaManutencao() {
  const { codigo = '' } = useParams();
  const { session } = useAuth();
  const nav = useNavigate();
  const [tipo, setTipo] = useState<TipoManutencao>('preventiva');
  const [checks, setChecks] = useState<Checklist>({});
  const [obs, setObs] = useState('');
  const [fotos, setFotos] = useState<Blob[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const adicionarFotos = async (lista: FileList | null) => {
    if (!lista) return;
    const novas = await Promise.all([...lista].map((f) => comprimirImagem(f)));
    setFotos((f) => [...f, ...novas].slice(0, 6));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return; // evita duplo toque
    setSalvando(true); setErro('');
    try {
      // equipamento_id vem da ficha ja aberta (funciona offline)
      const ficha = await lerFicha(codigo);
      if (!ficha) throw new Error('Abra a ficha do equipamento com internet ao menos uma vez.');
      await enfileirar({
        id: crypto.randomUUID(),
        equipamento_id: ficha.equipamento.id,
        tecnico_id: session!.user.id,
        tipo, checklist: checks, observacoes: obs.trim() || null,
        executada_em: new Date().toISOString(), fotos,
      });
      dispatchEvent(new Event('ac-fila-mudou'));
      nav(`/e/${codigo}`, { replace: true });
    } catch (err) {
      setErro((err as Error).message); setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar}>
      <h2>Nova manutenção</h2>
      <label>Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoManutencao)}>
          <option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option>
          <option value="limpeza">Limpeza</option><option value="instalacao">Instalação</option>
        </select>
      </label>
      <div className="cartao checklist">
        {ITENS_CHECKLIST.map((i) => (
          <label key={i.chave}>
            <input type="checkbox" checked={!!checks[i.chave]} onChange={(e) => setChecks({ ...checks, [i.chave]: e.target.checked })} />
            {i.rotulo}
          </label>
        ))}
      </div>
      <label>Observações<textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></label>
      <label>Fotos ({fotos.length}/6)
        <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }} />
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar registro'}</button>
    </form>
  );
}
