import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { edicoesPendentes, novosPendentes, pendentes, sincronizar } from '@ac/shared';
import { sb } from './env';

interface SyncCtx { online: boolean; fila: number; comErro: number; sincronizarAgora: () => Promise<void> }
const Ctx = createContext<SyncCtx>({ online: true, fila: 0, comErro: 0, sincronizarAgora: async () => {} });
export const useSync = () => useContext(Ctx);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [fila, setFila] = useState(0);
  const [comErro, setComErro] = useState(0);

  const atualizar = useCallback(async () => {
    const p = await pendentes();
    const n = await novosPendentes();
    setFila(p.length + (await edicoesPendentes()).length + n.length);
    setComErro(p.filter((x) => x.erro).length + n.filter((x) => x.erro).length);
  }, []);

  const sincronizarAgora = useCallback(async () => {
    if (navigator.onLine) await sincronizar(sb);
    await atualizar();
  }, [atualizar]);

  useEffect(() => {
    const on = () => { setOnline(true); sincronizarAgora(); };
    const off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    // fila e tela usam o mesmo evento: cada registro novo dispara envio imediato
    addEventListener('ac-fila-mudou', sincronizarAgora);
    const t = setInterval(sincronizarAgora, 30_000);
    sincronizarAgora();
    return () => { removeEventListener('online', on); removeEventListener('offline', off); removeEventListener('ac-fila-mudou', sincronizarAgora); clearInterval(t); };
  }, [sincronizarAgora]);

  return <Ctx.Provider value={{ online, fila, comErro, sincronizarAgora }}>{children}</Ctx.Provider>;
}
