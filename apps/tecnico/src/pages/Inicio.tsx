import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { extrairCodigo } from '@ac/shared';

export function Inicio() {
  const nav = useNavigate();
  const [lendo, setLendo] = useState(false);
  const [manual, setManual] = useState('');
  const [erro, setErro] = useState('');
  const leitor = useRef<Html5Qrcode | null>(null);

  const abrir = (texto: string) => {
    const c = extrairCodigo(texto);
    if (!c) { setErro('QR não reconhecido. Use a etiqueta do equipamento.'); return false; }
    nav(`/e/${c}`);
    return true;
  };

  useEffect(() => {
    if (!lendo) return;
    const l = new Html5Qrcode('leitor');
    leitor.current = l;
    l.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
      (texto) => { if (abrir(texto)) l.stop().catch(() => {}); }, () => {})
      .catch(() => { setErro('Não consegui abrir a câmera. Permita o acesso ou digite o código.'); setLendo(false); });
    return () => { l.isScanning ? l.stop().catch(() => {}) : undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lendo]);

  return (
    <>
      <div className="cartao">
        {lendo ? (
          <>
            <div id="leitor" />
            <button onClick={() => setLendo(false)} style={{ marginTop: 8, width: '100%' }}>Cancelar</button>
          </>
        ) : (
          <button className="primario" onClick={() => { setErro(''); setLendo(true); }}>Escanear QR Code</button>
        )}
      </div>
      <form className="cartao" onSubmit={(e) => { e.preventDefault(); abrir(manual); }}>
        <label>Ou digite o código da etiqueta
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="AC-XXXXXXXX" autoCapitalize="characters" />
        </label>
        <button>Abrir</button>
      </form>
      {erro && <p className="erro">{erro}</p>}
    </>
  );
}
