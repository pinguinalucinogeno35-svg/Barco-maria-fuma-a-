import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { urlDoQr } from '@ac/shared';

export function Etiqueta() {
  const { codigo = '' } = useParams();
  const [png, setPng] = useState('');
  useEffect(() => {
    // correcao de erro alta: etiqueta suja ou riscada continua legivel
    QRCode.toDataURL(urlDoQr(import.meta.env.VITE_TECNICO_URL, codigo), { errorCorrectionLevel: 'H', margin: 2, width: 512 }).then(setPng);
  }, [codigo]);

  return (
    <div style={{ textAlign: 'center' }}>
      {png && <img src={png} alt={`QR ${codigo}`} style={{ width: 260, height: 260 }} />}
      <h2 style={{ fontFamily: 'monospace' }}>{codigo}</h2>
      <div className="nao-imprime">
        <button className="primario" onClick={() => window.print()}>Imprimir etiqueta</button>
        <p><a href={png} download={`${codigo}.png`}>Baixar PNG</a></p>
      </div>
    </div>
  );
}
