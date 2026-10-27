/**
 * Extrai o caminho do arquivo dentro do bucket a partir da URL pública do Supabase Storage.
 * Devolve null quando a URL não pertence ao bucket informado.
 */
export function caminhoNoBucket(urlPublica: string, bucket: string): string | null {
  const partes = urlPublica.split(`/storage/v1/object/public/${bucket}/`);
  if (partes.length < 2 || !partes[1]) return null;
  return decodeURIComponent(partes[1].split('?')[0]);
}
