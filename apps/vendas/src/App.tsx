import { Link, Route, Routes } from 'react-router-dom';
import { Login, Logo, useAuth } from '@ac/shared';
import { Lista } from './pages/Lista';
import { NovoEquipamento } from './pages/NovoEquipamento';
import { Etiqueta } from './pages/Etiqueta';

export function App() {
  const { session, perfil, carregando, sair } = useAuth();
  if (carregando) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!session) return <Login app="Vendas" />;
  if (!perfil || (perfil.papel !== 'vendedor' && perfil.papel !== 'admin'))
    return <div className="app"><p className="erro">Seu usuário não tem acesso ao app de vendas.</p><button onClick={sair}>Sair</button></div>;
  return (
    <div className="app">
      <header className="topo nao-imprime">
        <Link to="/"><Logo largura={104} claro subtitulo={false} /></Link><span className="rotulo-app">Vendas</span><span className="espaco" />
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
