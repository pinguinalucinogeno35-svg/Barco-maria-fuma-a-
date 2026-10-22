import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@ac/shared';
import { sb } from '../env';

interface Func { id: string; nome: string; papel: 'tecnico' | 'admin'; ativo: boolean; email: string }
interface SemPerfil { id: string; email: string }
const NOME_PAPEL = { tecnico: 'Técnico', admin: 'Administrador' };

// A criacao de usuarios exige a chave de servico do Supabase, que fica so no servidor
// (funcao `funcionarios`); aqui o celular apenas pede, e o servidor confere se quem pede e admin.
async function chamar(corpo: Record<string, unknown>): Promise<{ dados?: any; erro?: string }> {
  const { data, error } = await sb.functions.invoke('funcionarios', { body: corpo });
  if (!error) return { dados: data };
  let erroMsg = 'Não foi possível concluir. Tente de novo.';
  try { const j = await (error as any).context?.json?.(); if (j?.erro) erroMsg = j.erro; } catch { /* mantem a mensagem padrao */ }
  return { erro: erroMsg };
}

export function Funcionarios() {
  const { session } = useAuth();
  const [lista, setLista] = useState<Func[]>([]);
  const [semPerfil, setSemPerfil] = useState<SemPerfil[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    const { dados, erro } = await chamar({ acao: 'listar' });
    if (erro) { setAviso({ tipo: 'erro', texto: erro }); return; }
    setLista(dados.funcionarios); setSemPerfil(dados.sem_perfil);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const executar = async (corpo: Record<string, unknown>, sucesso: string) => {
    const { erro } = await chamar(corpo);
    if (erro) { setAviso({ tipo: 'erro', texto: erro }); return false; }
    setAviso({ tipo: 'ok', texto: sucesso }); await carregar(); return true;
  };

  return (
    <>
      <div className="linha-acoes" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
        <span className="etiqueta-topico">Equipe ({lista.length})</span>
        <button className="primario" style={{ width: 'auto' }} onClick={() => setNovo(!novo)}>{novo ? 'Fechar' : '+ Funcionário'}</button>
      </div>
      {aviso && <p className={aviso.tipo === 'ok' ? 'ok' : 'erro'}>{aviso.texto}</p>}
      {novo && <NovoFuncionario onCriar={async (d) => { if (await executar({ acao: 'criar', ...d }, 'Funcionário criado.')) setNovo(false); }} />}
      <ul className="lista">
        {lista.map((f) => <Linha key={f.id} f={f} euMesmo={f.id === session?.user.id} executar={executar} />)}
      </ul>
      {semPerfil.length > 0 && (
        <div className="cartao">
          <h3 style={{ marginTop: 0 }}>Usuários sem perfil</h3>
          <small>Existem no login mas ainda não podem usar os apps.</small>
          {semPerfil.map((u) => <Vincular key={u.id} u={u} executar={executar} />)}
        </div>
      )}
    </>
  );
}

function NovoFuncionario({ onCriar }: { onCriar: (d: Record<string, string>) => Promise<void> }) {
  const [f, setF] = useState({ nome: '', email: '', papel: 'tecnico', senha: '' });
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="cartao" onSubmit={async (e) => { e.preventDefault(); setEnviando(true); await onCriar(f); setEnviando(false); }}>
      <label>Nome<input value={f.nome} onChange={set('nome')} required /></label>
      <label>E-mail<input type="email" value={f.email} onChange={set('email')} required autoCapitalize="none" /></label>
      <label>Função
        <select value={f.papel} onChange={set('papel')}><option value="tecnico">Técnico</option><option value="admin">Administrador</option></select>
      </label>
      <label>Senha inicial (mínimo 8 caracteres)<input value={f.senha} onChange={set('senha')} minLength={8} required autoComplete="off" /></label>
      <small>Passe a senha ao funcionário. Ele pode pedir para você trocá-la depois.</small>
      <button className="primario" style={{ marginTop: 10 }} disabled={enviando}>{enviando ? 'Criando…' : 'Criar funcionário'}</button>
    </form>
  );
}

function Linha({ f, euMesmo, executar }: { f: Func; euMesmo: boolean; executar: (c: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(f.nome);
  const [papel, setPapel] = useState(f.papel);
  const [senha, setSenha] = useState('');
  return (
    <li>
      <div className="linha-acoes" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{f.nome}</strong> {euMesmo && <small>(você)</small>}<br />
          <small>{f.email}</small>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="selo">{NOME_PAPEL[f.papel]}</span>{' '}
          {!f.ativo && <span className="selo inativo">Inativo</span>}
        </div>
      </div>
      <button style={{ marginTop: 8, minHeight: 36 }} onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Gerenciar'}</button>
      {aberto && (
        <div className="cartao">
          <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label>Função
            <select value={papel} onChange={(e) => setPapel(e.target.value as Func['papel'])} disabled={euMesmo}>
              <option value="tecnico">Técnico</option><option value="admin">Administrador</option>
            </select>
          </label>
          <button className="primario" onClick={() => executar({ acao: 'atualizar', id: f.id, nome, papel }, 'Dados salvos.')}>Salvar dados</button>
          <label>Nova senha (mínimo 8 caracteres)<input value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" /></label>
          <button disabled={senha.length < 8} onClick={async () => { if (await executar({ acao: 'senha', id: f.id, senha }, 'Senha trocada.')) setSenha(''); }}>Trocar senha</button>
          {!euMesmo && (
            <p>
              {f.ativo ? (
                <button style={{ color: 'var(--erro)' }} onClick={() => { if (confirm(`Desativar ${f.nome}? Ele não conseguirá mais entrar, mas o histórico dele continua guardado.`)) executar({ acao: 'atualizar', id: f.id, ativo: false }, 'Funcionário desativado.'); }}>Desativar acesso</button>
              ) : (
                <button onClick={() => executar({ acao: 'atualizar', id: f.id, ativo: true }, 'Funcionário reativado.')}>Reativar acesso</button>
              )}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Vincular({ u, executar }: { u: SemPerfil; executar: (c: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState('tecnico');
  return (
    <div style={{ borderTop: '1px solid var(--borda)', marginTop: 10, paddingTop: 6 }}>
      <strong>{u.email}</strong>
      <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <label>Função
        <select value={papel} onChange={(e) => setPapel(e.target.value)}><option value="tecnico">Técnico</option><option value="admin">Administrador</option></select>
      </label>
      <button disabled={!nome.trim()} onClick={() => executar({ acao: 'vincular', id: u.id, nome, papel }, 'Perfil criado.')}>Criar perfil</button>
    </div>
  );
}
