import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Logo, urlDoQr } from '@ac/shared';

export function Etiqueta() {
  const { codigo = '' } = useParams();
  const [png, setPng] = useState('');
  useEffect(() => {
    // correcao de erro alta: etiqueta suja ou riscada continua legivel
    QRCode.toDataURL(urlDoQr(import.meta.env.VITE_TECNICO_URL, codigo), { errorCorrectionLevel: 'H', margin: 2, width: 512, color: { dark: '#072a69', light: '#ffffff' } }).then(setPng);
  }, [codigo]);

  return (
    <div>
      <div className="etiqueta">
        <Logo largura={150} />
        {png && <img src={png} alt={`QR ${codigo}`} style={{ width: 220, height: 220, display: 'block', margin: '8px auto' }} />}
        <div className="codigo">{codigo}</div>
        <small>Escaneie para ver o histórico de manutenção</small>
      </div>
      <div className="nao-imprime" style={{ maxWidth: 320, margin: '16px auto' }}>
        <button className="primario" onClick={() => window.print()}>Imprimir etiqueta</button>
        <p style={{ textAlign: 'center' }}><a href={png} download={`${codigo}.png`}>Baixar PNG do QR</a></p>
      </div>
    </div>
  );
}
