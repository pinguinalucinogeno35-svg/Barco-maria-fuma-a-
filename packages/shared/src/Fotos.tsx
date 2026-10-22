import { useEffect, useState } from 'react';
import { useAuth } from './auth';

/** Miniaturas das fotos de um servico (bucket privado: links assinados e temporarios). */
export function Fotos({ caminhos }: { caminhos: string[] }) {
  const { sb } = useAuth();
  const [urls, setUrls] = useState<string[]>([]);
  const chave = caminhos.join('|');

  useEffect(() => {
    if (!caminhos.length) { setUrls([]); return; }
    let vivo = true;
    sb.storage.from('manutencoes').createSignedUrls(caminhos, 3600).then(({ data }) => {
      if (vivo) setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, chave]);

  if (!urls.length) return null;
  return (
    <div className="fotos">
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Foto do serviço" loading="lazy" /></a>
      ))}
    </div>
  );
}
