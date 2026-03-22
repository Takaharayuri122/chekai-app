/**
 * Resultado ao tentar abrir um PDF em nova aba após obter o Blob.
 * Quando bloqueado, use blobUrl + nomeArquivo para download manual (gesto do usuário).
 */
export type ResultadoAberturaPdf =
  | { bloqueado: true; blobUrl: string; nomeArquivo: string }
  | { bloqueado: false };

/**
 * Abre o PDF em nova aba. Se o navegador bloquear pop-ups, retorna os dados para download manual.
 */
export function abrirPdfBlobEmNovaAba(blob: Blob, nomeArquivo: string): ResultadoAberturaPdf {
  const blobUrl = URL.createObjectURL(blob);
  const novaJanela = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!novaJanela) {
    return { bloqueado: true, blobUrl, nomeArquivo };
  }
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 10 * 60 * 1000);
  return { bloqueado: false };
}

/**
 * Dispara o download do arquivo (deve ser chamado em resposta a clique do usuário).
 */
export function executarDownloadBlob(blobUrl: string, nomeArquivo: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = nomeArquivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
