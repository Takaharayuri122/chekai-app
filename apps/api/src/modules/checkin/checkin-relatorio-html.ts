import { RelatorioHorasCheckin } from './checkin.service';

function formatarMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas}h ${String(resto).padStart(2, '0')}min`;
}

export function montarHtmlRelatorioHoras(relatorio: RelatorioHorasCheckin): string {
  const agrupamento = relatorio.agruparPor === 'usuario' ? 'usuário' : 'cliente';
  const linhas = relatorio.itens.map((item) => `
    <tr>
      <td>${item.nome}</td>
      <td>${item.quantidade}</td>
      <td>${formatarMinutos(item.minutosFechados)}</td>
      <td>${formatarMinutos(item.minutosAbertos)}</td>
      <td>${formatarMinutos(item.minutosTotal)}</td>
    </tr>
  `).join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de horas de check-in</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1B2A4A; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #4B5563; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #E5E9F0; padding: 8px 10px; text-align: left; font-size: 13px; }
    th { background: #F4F7FB; }
    tfoot td { font-weight: bold; }
  </style>
</head>
<body>
  <h1>Relatório de horas de check-in</h1>
  <p>Período: ${relatorio.dataInicio} a ${relatorio.dataFim} · agrupado por ${agrupamento}</p>
  <table>
    <thead>
      <tr>
        <th>${relatorio.agruparPor === 'usuario' ? 'Usuário' : 'Cliente'}</th>
        <th>Check-ins</th>
        <th>Horas fechadas</th>
        <th>Em andamento</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || '<tr><td colspan="5">Nenhum check-in no período.</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total geral</td>
        <td>${formatarMinutos(relatorio.totalGeralMinutos)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}
