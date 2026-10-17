import { Link, Route, Routes } from 'react-router-dom';
import { Login, useAuth } from '@ac/shared';
import { Lista } from './pages/Lista';
import { NovoEquipamento } from './pages/NovoEquipamento';
import { Etiqueta } from './pages/Etiqueta';

export function App() {
  const { session, perfil, carregando, sair } = useAuth();
  if (carregando) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!session) return <Login />;
  if (!perfil || (perfil.papel !== 'vendedor' && perfil.papel !== 'admin'))
    return <div className="app"><p className="erro">Seu usuário não tem acesso ao app de vendas.</p><button onClick={sair}>Sair</button></div>;
  return (
    <div className="app">
      <header className="topo nao-imprime">
        <h1><Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>AC Vendas</Link></h1>
        <Link to="/novo">+ Equipamento</Link>
        <button onClick={sair}>Sair</button>
      </header>
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/novo" element={<NovoEquipamento />} />
        <Route path="/etiqueta/:codigo" element={<Etiqueta />} />
      </Routes>
    </div>
  );
}
