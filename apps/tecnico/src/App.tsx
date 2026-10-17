import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Login, useAuth } from '@ac/shared';
import { SyncProvider, useSync } from './sync';
import { Inicio } from './pages/Inicio';
import { Ficha } from './pages/Ficha';
import { NovaManutencao } from './pages/NovaManutencao';

function Faixa() {
  const { online, fila, comErro } = useSync();
  if (online && !fila) return null;
  return (
    <div className="faixa nao-imprime">
      {!online && 'Sem internet — os registros ficam salvos no celular. '}
      {fila > 0 && `${fila} registro(s) aguardando envio${comErro ? `, ${comErro} com erro` : ''}.`}
    </div>
  );
}

export function App() {
  const { session, perfil, carregando, sair } = useAuth();
  const { pathname } = useLocation();
  if (carregando) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!session) return <Login />;
  if (!perfil || (perfil.papel !== 'tecnico' && perfil.papel !== 'admin'))
    return <div className="app"><p className="erro">Seu usuário não tem acesso ao app de técnico. Fale com a administração.</p><button onClick={sair}>Sair</button></div>;

  return (
    <SyncProvider>
      <Faixa />
      <div className="app">
        <header className="topo">
          <h1><Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>AC Técnico</Link></h1>
          {pathname !== '/' && <Link to="/">Início</Link>}
          <button onClick={sair}>Sair</button>
        </header>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/e/:codigo" element={<Ficha />} />
          <Route path="/e/:codigo/nova" element={<NovaManutencao />} />
          <Route path="*" element={<p>Página não encontrada.</p>} />
        </Routes>
      </div>
    </SyncProvider>
  );
}
