export async function emitirAlertaCheckinAberto(
  checkinId: string,
  mensagem: string,
): Promise<'notification' | 'toast'> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'toast';
  }
  let permissao = Notification.permission;
  if (permissao === 'default') {
    permissao = await Notification.requestPermission();
  }
  if (permissao !== 'granted') {
    return 'toast';
  }
  new Notification('Check-in em aberto', {
    body: mensagem,
    tag: checkinId,
  });
  return 'notification';
}
