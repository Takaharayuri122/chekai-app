/** HH:mm (pt-BR); com dd/MM quando a data não é de hoje. Vazio se a data for inválida. */
export function formatarHora(dataIso: string | null | undefined): string {
  if (!dataIso) return '';
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return '';
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (data.toDateString() === new Date().toDateString()) return hora;
  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${dia} ${hora}`;
}

/** Texto do estado de envio de uma marcação feita no aparelho. */
export function textoEnvio(
  envioStatus: 'pendente' | 'enviado' | 'recusado' | null,
  sincronizadoEm: string | null,
): string | null {
  if (envioStatus === 'pendente') return 'Aguardando envio';
  if (envioStatus === 'enviado') {
    const hora = formatarHora(sincronizadoEm);
    return hora ? `Enviado às ${hora}` : 'Enviado';
  }
  return null;
}
