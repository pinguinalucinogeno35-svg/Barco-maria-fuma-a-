// Gestao de funcionarios para o admin: criar usuario, renomear, trocar papel,
// desativar/reativar e redefinir senha. Usa a chave de servico, que nunca sai daqui;
// a autenticacao e feita no proprio codigo (so admin ativo pode chamar).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PAPEIS = ['tecnico', 'admin'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BANIDO = '876000h'; // ~100 anos: impede login e renovacao de sessao

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: sessao, error: erroSessao } = await servico.auth.getUser(token);
  if (erroSessao || !sessao.user) return json({ erro: 'Sessão inválida. Entre de novo.' }, 401);
  const euId = sessao.user.id;
  const { data: eu } = await servico.from('perfis').select('papel, ativo').eq('id', euId).maybeSingle();
  if (!eu?.ativo || eu.papel !== 'admin') return json({ erro: 'Apenas administradores.' }, 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (b.acao === 'listar') {
    const { data: perfis, error } = await servico.from('perfis').select('id,nome,papel,ativo,criado_em').order('nome');
    if (error) return json({ erro: 'Erro ao listar.' }, 500);
    const emails = new Map<string, string>();
    const semPerfil: { id: string; email: string }[] = [];
    for (let pagina = 1; ; pagina++) {
      const { data, error: e } = await servico.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (e) return json({ erro: 'Erro ao listar.' }, 500);
      for (const u of data.users) emails.set(u.id, u.email ?? '');
      if (data.users.length < 200) break;
    }
    const comPerfil = new Set(perfis.map((p) => p.id));
    for (const [id, email] of emails) if (!comPerfil.has(id)) semPerfil.push({ id, email });
    return json({ funcionarios: perfis.map((p) => ({ ...p, email: emails.get(p.id) ?? '' })), sem_perfil: semPerfil });
  }

  if (b.acao === 'criar') {
    const email = texto(b.email).toLowerCase(), senha = typeof b.senha === 'string' ? b.senha : '', nome = texto(b.nome), papel = texto(b.papel);
    if (!EMAIL.test(email)) return json({ erro: 'E-mail inválido.' }, 400);
    if (senha.length < 8) return json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
    if (!nome) return json({ erro: 'Informe o nome.' }, 400);
    if (!PAPEIS.includes(papel)) return json({ erro: 'Papel inválido.' }, 400);
    const { data: novo, error } = await servico.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !novo.user) {
      const jaExiste = /already|registered|exists/i.test(error?.message ?? '');
      return json({ erro: jaExiste ? 'Este e-mail já está cadastrado.' : 'Não foi possível criar o usuário.' }, 400);
    }
    const { error: ep } = await servico.from('perfis').insert({ id: novo.user.id, nome, papel });
    if (ep) { await servico.auth.admin.deleteUser(novo.user.id); return json({ erro: 'Erro ao criar o perfil.' }, 500); }
    return json({ ok: true, id: novo.user.id });
  }

  // usuario que ja existe no Auth mas ainda nao tem perfil
  if (b.acao === 'vincular') {
    const id = texto(b.id), nome = texto(b.nome), papel = texto(b.papel);
    if (!id || !nome || !PAPEIS.includes(papel)) return json({ erro: 'Dados inválidos.' }, 400);
    const { error } = await servico.from('perfis').insert({ id, nome, papel });
    return error ? json({ erro: 'Não foi possível criar o perfil.' }, 400) : json({ ok: true });
  }

  if (b.acao === 'atualizar') {
    const id = texto(b.id);
    if (!id) return json({ erro: 'Funcionário não informado.' }, 400);
    const mudanca: Record<string, unknown> = {};
    if (b.nome !== undefined) { if (!texto(b.nome)) return json({ erro: 'Informe o nome.' }, 400); mudanca.nome = texto(b.nome); }
    if (b.papel !== undefined) { if (!PAPEIS.includes(texto(b.papel))) return json({ erro: 'Papel inválido.' }, 400); mudanca.papel = texto(b.papel); }
    if (b.ativo !== undefined) mudanca.ativo = b.ativo === true;
    if (id === euId && (mudanca.ativo === false || (mudanca.papel && mudanca.papel !== 'admin')))
      return json({ erro: 'Você não pode desativar nem rebaixar a si mesmo.' }, 400);
    const { error } = await servico.from('perfis').update(mudanca).eq('id', id);
    if (error) return json({ erro: 'Erro ao salvar.' }, 500);
    if (b.ativo !== undefined) {
      const { error: eb } = await servico.auth.admin.updateUserById(id, { ban_duration: b.ativo === true ? 'none' : BANIDO });
      if (eb) return json({ erro: 'Perfil salvo, mas não foi possível bloquear o login.' }, 500);
    }
    return json({ ok: true });
  }

  if (b.acao === 'senha') {
    const id = texto(b.id), senha = typeof b.senha === 'string' ? b.senha : '';
    if (!id) return json({ erro: 'Funcionário não informado.' }, 400);
    if (senha.length < 8) return json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);
    const { error } = await servico.auth.admin.updateUserById(id, { password: senha });
    return error ? json({ erro: 'Não foi possível trocar a senha.' }, 500) : json({ ok: true });
  }

  return json({ erro: 'Ação desconhecida.' }, 400);
});
