/** Reduz a foto (celulares geram 5-10 MB) para ~200 KB antes de guardar/enviar. */
export async function comprimirImagem(arquivo: Blob, ladoMax = 1280, qualidade = 0.72): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, falha) =>
    c.toBlob((b) => (b ? ok(b) : falha(new Error('falha ao comprimir'))), 'image/jpeg', qualidade),
  );
}
