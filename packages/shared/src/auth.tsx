import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Supabase } from './supabase';
import type { Papel } from './types';

export interface Perfil { id: string; nome: string; papel: Papel }
interface Ctx { sb: Supabase; session: Session | null; perfil: Perfil | null; carregando: boolean; sair: () => void }

const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
};

const CHAVE_PERFIL = 'ac-perfil';

export function AuthProvider({ sb, children }: { sb: Supabase; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(() => {
    try { return JSON.parse(localStorage.getItem(CHAVE_PERFIL) ?? 'null'); } catch { return null; }
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // getSession le do armazenamento local: funciona offline com o login ja feito.
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setCarregando(false); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!session) { if (!carregando) { setPerfil(null); localStorage.removeItem(CHAVE_PERFIL); } return; }
    sb.from('perfis').select('id,nome,papel').eq('id', session.user.id).eq('ativo', true).maybeSingle()
      .then(({ data, error }) => {
        if (error) return; // offline: mantem o perfil em cache
        setPerfil(data as Perfil | null);
        if (data) localStorage.setItem(CHAVE_PERFIL, JSON.stringify(data));
      });
  }, [sb, session, carregando]);

  const sair = () => { sb.auth.signOut(); };
  return <AuthCtx.Provider value={{ sb, session, perfil, carregando, sair }}>{children}</AuthCtx.Provider>;
}

export function Login() {
  const { sb } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setErro('');
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) setErro(navigator.onLine ? 'E-mail ou senha incorretos.' : 'Sem internet. O primeiro login precisa de conexão.');
    setEnviando(false);
  };

  return (
    <form className="login" onSubmit={entrar}>
      <h1>Entrar</h1>
      <label>E-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Senha<input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="primario" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
