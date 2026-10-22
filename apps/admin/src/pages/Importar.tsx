import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CAMPOS, decodificar, gerarCodigo, lerCsv, MODELO_CSV, sugerirMapeamento, urlDoQr, useAuth, validarLinha,
  type Campo, type LinhaImportada,
} from '@ac/shared';
import { sb } from '../env';
import { baixarCsv } from '../csv';

const LOTE = 400;                 // linhas por pedido ao banco
const PAGINA = 1000;
const TESTE = 10;
type Etapa = 'escolher' | 'revisar' | 'importando' | 'pronto';
interface Historico { id: string; criada_em: string; arquivo: string | null; linhas_lidas: number; equipamento_ids: string[]; concluida: boolean; desfeita_em: string | null }
interface Existentes { clientes: Map<string, string>; series: Set<string> }
const chaveSerie = (s: string) => s.trim().toUpperCase();
const dataBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function lerPaginas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const todas: T[] = [];
  for (let i = 0; ; i += PAGINA) {
    const { data, error } = await pagina(i, i + PAGINA - 1);
    if (error) throw error;
    todas.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGINA) return todas;
  }
}

export function Importar() {
  const { session } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [arquivo, setArquivo] = useState('');
  const [tabela, setTabela] = useState<string[][]>([]);
  const [mapa, setMapa] = useState<Record<Campo, number> | null>(null);
  const [existentes, setExistentes] = useState<Existentes | null>(null);
  const [soTeste, setSoTeste] = useState(false);
  const [progresso, setProgresso] = useState({ texto: '', pct: 0 });
  const [resultado, setResultado] = useState<{ id: string; aparelhos: number; clientes: number; erro?: string } | null>(null);
  const [erro, setErro] = useState('');
  const [historico, setHistorico] = useState<Historico[]>([]);

  const carregarHistorico = useCallback(async () => {
    const { data } = await sb.from('importacoes').select('id,criada_em,arquivo,linhas_lidas,equipamento_ids,concluida,desfeita_em').order('criada_em', { ascending: false }).limit(20);
    setHistorico((data as Historico[]) ?? []);
  }, []);
  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setErro('');
    try {
      const linhas = lerCsv(decodificar(await f.arrayBuffer()));
      if (linhas.length < 2) { setErro('A planilha está vazia ou só tem o cabeçalho.'); return; }
      setArquivo(f.name); setTabela(linhas); setMapa(sugerirMapeamento(linhas[0])); setEtapa('revisar');
      // o que ja existe no sistema, para nao duplicar clientes nem aparelhos
      const [cli, ser] = await Promise.all([
        lerPaginas<{ id: string; nome: string }>((i, a) => sb.from('clientes').select('id,nome').order('id').range(i, a)),
        lerPaginas<{ numero_serie: string }>((i, a) => sb.from('equipamentos').select('numero_serie').not('numero_serie', 'is', null).eq('ativo', true).order('id').range(i, a)),
      ]);
      setExistentes({ clientes: new Map(cli.map((c) => [norm(c.nome), c.id])), series: new Set(ser.map((s) => chaveSerie(s.numero_serie))) });
    } catch { setErro('Não consegui ler o arquivo. Salve a planilha como "CSV" no Excel e tente de novo.'); }
  };

  const analise = useMemo(() => {
    if (!mapa || !existentes) return null;
    const validas: LinhaImportada[] = [], erros: { linha: number; erro: string }[] = [], ignoradas: { linha: number; motivo: string }[] = [];
    const vistas = new Map<string, number>();
    tabela.slice(1).forEach((cel, i) => {
      const r = validarLinha(cel, mapa, i + 2);
      if ('erro' in r) { erros.push({ linha: r.linha, erro: r.erro }); return; }
      const l = r.ok;
      if (l.serie) {
        const k = chaveSerie(l.serie);
        if (existentes.series.has(k)) { ignoradas.push({ linha: l.linha, motivo: `Série ${l.serie} já cadastrada no sistema` }); return; }
        if (vistas.has(k)) { ignoradas.push({ linha: l.linha, motivo: `Série ${l.serie} repetida (linha ${vistas.get(k)})` }); return; }
        vistas.set(k, l.linha);
      }
      validas.push(l);
    });
    const prontas = soTeste ? validas.slice(0, TESTE) : validas;
    const chaves = new Set(prontas.map((l) => l.chaveCliente));
    const novos = [...chaves].filter((c) => !existentes.clientes.has(c)).length;
    const avisos = prontas.reduce((n, l) => n + l.avisos.length, 0);
    return { prontas, erros, ignoradas, clientesNovos: novos, clientesExistentes: chaves.size - novos, avisos, totalLinhas: tabela.length - 1 };
  }, [tabela, mapa, existentes, soTeste]);

  const importar = async () => {
    if (!analise || !existentes || !session) return;
    const { prontas } = analise;
    setEtapa('importando'); setErro('');
    const eu = session.user.id;
    let importacaoId = '';
    const equipamentoIds: string[] = [], clienteIds: string[] = [];
    try {
      const { data: imp, error: e0 } = await sb.from('importacoes').insert({ criada_por: eu, arquivo, linhas_lidas: analise.totalLinhas }).select('id').single();
      if (e0 || !imp) throw e0;
      importacaoId = imp.id;

      // 1) clientes novos
      const mapaCli = new Map(existentes.clientes);
      const novos: { id: string; nome: string; documento: string | null; telefone: string | null; endereco: string | null }[] = [];
      for (const l of prontas) {
        if (mapaCli.has(l.chaveCliente)) continue;
        const id = crypto.randomUUID();
        mapaCli.set(l.chaveCliente, id);
        novos.push({ id, nome: l.cliente, documento: l.documento, telefone: l.telefone, endereco: l.endereco });
      }
      for (let i = 0; i < novos.length; i += LOTE) {
        setProgresso({ texto: `Cadastrando clientes (${Math.min(i + LOTE, novos.length)} de ${novos.length})`, pct: Math.round((i / Math.max(prontas.length, 1)) * 15) });
        const lote = novos.slice(i, i + LOTE);
        const { error } = await sb.from('clientes').insert(lote);
        if (error) throw error;
        clienteIds.push(...lote.map((c) => c.id));
      }
      await sb.from('importacoes').update({ cliente_ids: clienteIds }).eq('id', importacaoId);

      // 2) etiquetas + aparelhos, em lotes
      for (let i = 0; i < prontas.length; i += LOTE) {
        const parte = prontas.slice(i, i + LOTE);
        setProgresso({ texto: `Cadastrando aparelhos (${Math.min(i + LOTE, prontas.length)} de ${prontas.length})`, pct: 15 + Math.round(((i + parte.length) / prontas.length) * 85) });
        let codigos: string[] = [];
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          const conj = new Set<string>();
          while (conj.size < parte.length) conj.add(gerarCodigo());
          codigos = [...conj];
          const { error } = await sb.from('etiquetas').insert(codigos.map((codigo) => ({ codigo, criada_por: eu })));
          if (!error) break;
          if (error.code !== '23505' || tentativa === 2) throw error;
        }
        const linhas = parte.map((l, k) => ({
          id: crypto.randomUUID(), codigo: codigos[k], cliente_id: mapaCli.get(l.chaveCliente)!, local_instalacao: l.local, marca: l.marca,
          modelo: l.modelo, btus: l.btus, numero_serie: l.serie, data_instalacao: l.instalacao,
          ...(l.periodicidade ? { periodicidade_dias: l.periodicidade } : {}), criado_por: eu,
        }));
        const { error: ee } = await sb.from('equipamentos').insert(linhas);
        if (ee) throw ee;
        equipamentoIds.push(...linhas.map((x) => x.id));
        const ultimas = parte.map((l, k) => (l.ultima ? { equipamento_id: linhas[k].id, data: l.ultima } : null)).filter(Boolean);
        if (ultimas.length) { const { error } = await sb.from('importacoes_ultima').insert(ultimas as object[]); if (error) throw error; }
        await sb.from('importacoes').update({ equipamento_ids: equipamentoIds }).eq('id', importacaoId);
      }
      await sb.from('importacoes').update({ concluida: true }).eq('id', importacaoId);
      setResultado({ id: importacaoId, aparelhos: equipamentoIds.length, clientes: clienteIds.length });
    } catch (e) {
      if (importacaoId) await sb.from('importacoes').update({ equipamento_ids: equipamentoIds, cliente_ids: clienteIds }).eq('id', importacaoId);
      setResultado({ id: importacaoId, aparelhos: equipamentoIds.length, clientes: clienteIds.length, erro: (e as { message?: string })?.message ?? 'Erro desconhecido' });
    }
    setEtapa('pronto'); carregarHistorico();
  };

  const desfazer = async (h: Historico) => {
    if (!confirm(`Desfazer a importação de ${h.equipamento_ids.length} aparelho(s)? Eles serão arquivados e saem das listas. Os clientes cadastrados ficam.`)) return;
    const { error } = await sb.rpc('desfazer_importacao', { p_id: h.id });
    if (error) setErro('Não foi possível desfazer a importação.'); else { setErro(''); carregarHistorico(); }
  };

  const baixarCodigos = async (ids: string[], nome: string) => {
    setErro('');
    try {
      const linhas: (string | null)[][] = [['Código', 'Endereço do QR', 'Cliente', 'Local', 'Marca', 'Modelo']];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await sb.from('equipamentos').select('codigo,marca,modelo,local_instalacao,clientes(nome)').in('id', ids.slice(i, i + 100));
        if (error) throw error;
        for (const e of (data ?? []) as any[]) linhas.push([e.codigo, urlDoQr(import.meta.env.VITE_TECNICO_URL, e.codigo), e.clientes?.nome ?? '', e.local_instalacao, e.marca, e.modelo]);
      }
      baixarCsv(`codigos_${nome}.csv`, linhas);
    } catch { setErro('Não foi possível gerar a planilha de códigos.'); }
  };

  const reiniciar = () => { setEtapa('escolher'); setTabela([]); setMapa(null); setExistentes(null); setResultado(null); setSoTeste(false); setErro(''); };

  return (
    <>
      <h2 style={{ marginTop: 4 }}>Importar planilha de aparelhos</h2>
      {erro && <p className="erro">{erro}</p>}

      {etapa === 'escolher' && (
        <div className="cartao">
          <p style={{ marginTop: 0 }}>Cada linha da planilha é um aparelho. Salve no Excel como <strong>CSV</strong> (Arquivo, Salvar como, "CSV (separado por vírgulas)" ou "CSV UTF-8").</p>
          <label>Escolher arquivo<input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => escolher(e.target.files?.[0])} /></label>
          <p><button onClick={() => baixarCsv('modelo_importacao.csv', MODELO_CSV)}>Baixar planilha modelo</button></p>
          <small>Só <strong>Cliente</strong> é obrigatório. Marca em branco vira "Não informada". Se o aparelho tem número de série, ele não é cadastrado duas vezes. A coluna "Última manutenção" define quando vence a próxima.</small>
        </div>
      )}

      {etapa === 'revisar' && mapa && (
        <>
          <div className="cartao">
            <strong>{arquivo}</strong> — {tabela.length - 1} linha(s)
            <p><small>Confira se cada campo aponta para a coluna certa. Sugeri pelo nome do cabeçalho.</small></p>
            {CAMPOS.map((c) => (
              <label key={c.chave}>{c.rotulo}{c.obrigatorio ? ' *' : ''}
                <select value={mapa[c.chave]} onChange={(e) => setMapa({ ...mapa, [c.chave]: Number(e.target.value) })}>
                  <option value={-1}>(não usar)</option>
                  {tabela[0].map((h, i) => <option key={i} value={i}>Coluna {i + 1}: {h || '(sem título)'}</option>)}
                </select>
              </label>
            ))}
          </div>

          {!existentes && <p>Conferindo o que já existe no sistema…</p>}
          {mapa.cliente < 0 && <p className="erro">Escolha a coluna do cliente.</p>}
          {analise && mapa.cliente >= 0 && (
            <div className="cartao">
              <span className="etiqueta-topico">Resumo</span>
              <ul className="lista">
                <li><strong>{analise.prontas.length}</strong> aparelho(s) serão cadastrados{soTeste && ` (modo teste: só os ${TESTE} primeiros)`}</li>
                <li>{analise.clientesNovos} cliente(s) novo(s) · {analise.clientesExistentes} já cadastrado(s)</li>
                {analise.ignoradas.length > 0 && <li className="alerta">{analise.ignoradas.length} ignorado(s) por duplicidade</li>}
                {analise.erros.length > 0 && <li className="erro">{analise.erros.length} linha(s) com erro (não serão importadas)</li>}
                {analise.avisos > 0 && <li className="alerta">{analise.avisos} aviso(s) (ex.: sem marca)</li>}
              </ul>
              {analise.erros.length > 0 && (
                <details><summary>Ver erros</summary>
                  <ul className="lista">{analise.erros.slice(0, 50).map((x) => <li key={x.linha}><small>Linha {x.linha}: {x.erro}</small></li>)}{analise.erros.length > 50 && <li><small>…e mais {analise.erros.length - 50}</small></li>}</ul>
                </details>
              )}
              {analise.ignoradas.length > 0 && (
                <details><summary>Ver ignorados</summary>
                  <ul className="lista">{analise.ignoradas.slice(0, 50).map((x) => <li key={x.linha}><small>Linha {x.linha}: {x.motivo}</small></li>)}{analise.ignoradas.length > 50 && <li><small>…e mais {analise.ignoradas.length - 50}</small></li>}</ul>
                </details>
              )}
              <details><summary>Ver as primeiras linhas como serão cadastradas</summary>
                <ul className="lista">{analise.prontas.slice(0, 8).map((l) => (
                  <li key={l.linha}><small><strong>{l.cliente}</strong> · {l.marca} {l.modelo ?? ''} {l.btus ? `· ${l.btus} BTU` : ''} · {l.local ?? 'sem local'} · última: {l.ultima ?? '—'} · a cada {l.periodicidade ?? 30} dias</small></li>
                ))}</ul>
              </details>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 22, height: 22, minHeight: 0, margin: 0 }} checked={soTeste} onChange={(e) => setSoTeste(e.target.checked)} />
                Teste: importar só as {TESTE} primeiras linhas
              </label>
              <button className="primario" style={{ marginTop: 10 }} disabled={!analise.prontas.length} onClick={importar}>Importar {analise.prontas.length} aparelho(s)</button>
            </div>
          )}
          <button onClick={reiniciar}>Escolher outro arquivo</button>
        </>
      )}

      {etapa === 'importando' && (
        <div className="cartao">
          <p style={{ marginTop: 0 }}>{progresso.texto || 'Preparando…'}</p>
          <div style={{ background: 'var(--borda)', borderRadius: 999, height: 10 }}><div style={{ width: `${progresso.pct}%`, height: 10, borderRadius: 999, background: 'var(--azul)', transition: 'width .3s' }} /></div>
          <small>Não feche esta tela até terminar.</small>
        </div>
      )}

      {etapa === 'pronto' && resultado && (
        <div className="cartao">
          {resultado.erro ? (
            <>
              <p className="erro" style={{ marginTop: 0 }}>A importação parou no meio: {resultado.erro}</p>
              <p>{resultado.aparelhos} aparelho(s) e {resultado.clientes} cliente(s) já tinham sido cadastrados. Você pode desfazer este lote no histórico abaixo e tentar de novo.</p>
            </>
          ) : (
            <p className="ok" style={{ marginTop: 0 }}><strong>{resultado.aparelhos}</strong> aparelho(s) e <strong>{resultado.clientes}</strong> cliente(s) novo(s) cadastrados.</p>
          )}
          {resultado.aparelhos > 0 && (
            <div className="linha-acoes">
              <Link to={`/importar/${resultado.id}/etiquetas`}><button className="primario" style={{ width: 'auto' }}>Imprimir etiquetas</button></Link>
              <button onClick={() => { const h = historico.find((x) => x.id === resultado.id); if (h) baixarCodigos(h.equipamento_ids, dataBR(h.criada_em).replace(/\D+/g, '_')); }}>Baixar planilha dos códigos</button>
            </div>
          )}
          <p><button onClick={reiniciar}>Importar outra planilha</button></p>
        </div>
      )}

      <div className="cartao">
        <span className="etiqueta-topico">Importações anteriores</span>
        <ul className="lista">
          {historico.map((h) => (
            <li key={h.id}>
              <strong>{h.arquivo ?? 'sem nome'}</strong> <small>· {dataBR(h.criada_em)}</small><br />
              <small>{h.equipamento_ids.length} aparelho(s) · {h.desfeita_em ? 'desfeita' : h.concluida ? 'concluída' : 'incompleta'}</small>
              {!h.desfeita_em && h.equipamento_ids.length > 0 && (
                <div className="linha-acoes" style={{ marginTop: 6 }}>
                  <Link to={`/importar/${h.id}/etiquetas`}>Etiquetas</Link>
                  <a href="#codigos" onClick={(e) => { e.preventDefault(); baixarCodigos(h.equipamento_ids, dataBR(h.criada_em).replace(/\D+/g, '_')); }}>Planilha dos códigos</a>
                  <a href="#desfazer" style={{ color: 'var(--erro)' }} onClick={(e) => { e.preventDefault(); desfazer(h); }}>Desfazer</a>
                </div>
              )}
            </li>
          ))}
          {!historico.length && <li>Nenhuma importação ainda.</li>}
        </ul>
      </div>
    </>
  );
}
