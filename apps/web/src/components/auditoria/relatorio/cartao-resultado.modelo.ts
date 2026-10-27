import type { ResultadoAuditoria } from '@/lib/api';
import { posicaoNaBarra, segmentosDaBarra } from '@/lib/checklist/barra-faixas';

export const DICA_TENDENCIA = 'Comparado com a avaliação anterior';
export const MAX_DESTINATARIOS = 5;

const MAX_ANTERIORES = 3;
const EMAIL_VALIDO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')}%`;
}

const CONTADORES: { chave: keyof ResultadoAuditoria['contadores']; rotulo: string }[] = [
  { chave: 'pontosPossiveis', rotulo: 'Pontos possíveis' },
  { chave: 'pontosRealizados', rotulo: 'Pontos realizados' },
  { chave: 'naoConformidades', rotulo: 'Não conformidades' },
  { chave: 'fotos', rotulo: 'Fotos' },
  { chave: 'planosAcao', rotulo: 'Planos de ação' },
];

export function contadoresDoCartao(contadores: ResultadoAuditoria['contadores']) {
  return CONTADORES.map(({ chave, rotulo }) => ({ chave, rotulo, valor: contadores[chave] }));
}

export function modeloDoCartao(resultado: ResultadoAuditoria) {
  const { tendencia } = resultado;
  const seta =
    tendencia === 'subiu'
      ? { glifo: '▲', classe: 'text-success', dica: DICA_TENDENCIA }
      : tendencia === 'caiu'
        ? { glifo: '▼', classe: 'text-destructive', dica: DICA_TENDENCIA }
        : null;
  const anteriores = (resultado.anteriores ?? []).slice(0, MAX_ANTERIORES).map((a) => ({
    id: a.id,
    dataFim: a.dataFim,
    percentual: formatarPercentual(a.aproveitamento),
  }));
  return {
    emoji: resultado.classificacao.emoji,
    nomeClassificacao: resultado.classificacao.nome,
    corClassificacao: resultado.classificacao.cor,
    percentual: formatarPercentual(resultado.aproveitamento),
    seta,
    anteriores,
    mostrarHistorico: anteriores.length > 0,
    segmentos: segmentosDaBarra(resultado.faixas),
    posicaoMarcador: posicaoNaBarra(resultado.aproveitamento),
    contadores: contadoresDoCartao(resultado.contadores),
  };
}

export function interpretarDestinatarios(texto: string): { emails: string[]; erro: string | null } {
  const emails: string[] = [];
  for (const parte of texto.split(/[,;\n]/)) {
    const email = parte.trim();
    if (email && !emails.some((e) => e.toLowerCase() === email.toLowerCase())) emails.push(email);
  }
  if (emails.length === 0) return { emails, erro: 'Informe ao menos um e-mail.' };
  if (emails.length > MAX_DESTINATARIOS) return { emails, erro: `Informe no máximo ${MAX_DESTINATARIOS} e-mails.` };
  const invalido = emails.find((e) => !EMAIL_VALIDO.test(e));
  if (invalido) return { emails, erro: `E-mail inválido: ${invalido}` };
  return { emails, erro: null };
}
