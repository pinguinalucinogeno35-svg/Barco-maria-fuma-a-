/** Baixa uma planilha CSV pronta para abrir no Excel em portugues (separador ;, com acentos). */
export function baixarCsv(nome: string, linhas: (string | number | null | undefined)[][]) {
  const celula = (v: string | number | null | undefined) => {
    let t = v == null ? '' : String(v);
    // evita que o Excel trate texto como formula
    if (/^[=+\-@]/.test(t) && typeof v === 'string') t = "'" + t;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const texto = '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
