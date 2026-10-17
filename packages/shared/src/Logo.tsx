/**
 * Marca Rede Frio recriada em SVG a partir do site (provisoria: trocar pelo arquivo oficial do logo).
 * `claro`: versao para fundo escuro.
 */
export function Logo({ largura = 150, claro = false, subtitulo = true }: { largura?: number; claro?: boolean; subtitulo?: boolean }) {
  const rede = claro ? '#ffffff' : '#0d4b9a';
  const frio = claro ? '#bde0ff' : '#8fa2bd';
  const sub = claro ? '#bde0ff' : '#10295e';
  const alt = subtitulo ? 52 : 38;
  return (
    <svg className="logo" role="img" aria-label="Rede Frio — Soluções em Climatização" width={largura} height={(largura * alt) / 128} viewBox={`0 0 128 ${alt}`}>
      <defs>
        <linearGradient id={`onda-${claro}`} x1="0" x2="1">
          <stop offset="0" stopColor={claro ? '#bde0ff' : '#072a69'} />
          <stop offset="1" stopColor={claro ? '#ffffff' : '#3b9bf0'} />
        </linearGradient>
      </defs>
      <text x="0" y="26" fontFamily="Poppins, system-ui, sans-serif" fontSize="29" fontWeight="700" fill={rede} letterSpacing="-1">Rede</text>
      <text x="75" y="26" fontFamily="Poppins, system-ui, sans-serif" fontSize="29" fontWeight="400" fill={frio} letterSpacing="-1">Frio</text>
      <path d="M0 33 C 12 27, 22 38, 36 32 S 62 28, 72 33" fill="none" stroke={`url(#onda-${claro})`} strokeWidth="3" strokeLinecap="round" />
      {subtitulo && (
        <text x="0" y="48" fontFamily="Poppins, system-ui, sans-serif" fontSize="8.4" fontWeight="500" fill={sub}>Soluções em Climatização</text>
      )}
    </svg>
  );
}
