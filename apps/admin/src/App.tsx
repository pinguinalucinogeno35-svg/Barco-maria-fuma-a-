import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { Login, Logo, useAuth } from '@ac/shared';
import { Lista } from './pages/Lista';
import { NovoEquipamento } from './pages/NovoEquipamento';
import { Etiqueta } from './pages/Etiqueta';
import { Detalhe } from './pages/Detalhe';
import { Clientes, ClienteForm } from './pages/Clientes';
import { Servicos } from './pages/Servicos';
import { ServicoEditar } from './pages/ServicoEditar';
import { Etiquetas } from './pages/Etiquetas';
import { Funcionarios } from './pages/Funcionarios';
import { Relatorios } from './pages/Relatorios';

export function App() {
  const { session, perfil, carregando, sair } = useAuth();
  if (carregando) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!session) return <Login app="Administração" />;
  if (!perfil || (perfil.papel !== 'admin'))
    return <div className="app"><p className="erro">Seu usuário não tem acesso ao app de administração.</p><button onClick={sair}>Sair</button></div>;
  return (
    <div className="app">
      <header className="topo nao-imprime">
        <Link to="/"><Logo largura={104} claro subtitulo={false} /></Link><span className="rotulo-app">Admin</span><span className="espaco" />
        <button onClick={sair}>Sair</button>
      </header>
      <nav className="abas nao-imprime">
        <NavLink to="/" end>Aparelhos</NavLink><NavLink to="/servicos">Serviços</NavLink>
        <NavLink to="/clientes">Clientes</NavLink><NavLink to="/etiquetas">Etiquetas</NavLink><NavLink to="/relatorios">Relatórios</NavLink><NavLink to="/equipe">Equipe</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/novo" element={<NovoEquipamento />} />
        <Route path="/etiqueta/:codigo" element={<Etiqueta />} />
        <Route path="/e/:codigo" element={<Detalhe />} />
        <Route path="/e/:codigo/editar" element={<NovoEquipamento />} />
        <Route path="/servicos" element={<Servicos />} />
        <Route path="/servicos/:id" element={<ServicoEditar />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/novo" element={<ClienteForm />} />
        <Route path="/clientes/:id" element={<ClienteForm />} />
        <Route path="/etiquetas" element={<Etiquetas />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/equipe" element={<Funcionarios />} />
      </Routes>
    </div>
  );
}
