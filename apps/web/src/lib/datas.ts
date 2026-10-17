/** Data no formato yyyy-mm-dd no fuso local do navegador (toISOString usaria UTC e viraria o dia após 21h no Brasil). */
export function dataLocalISO(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
