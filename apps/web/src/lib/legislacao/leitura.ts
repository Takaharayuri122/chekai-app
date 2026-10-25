import type { SituacaoLegislacao, StatusLeitura } from '@/lib/api';

const ROTULOS_STATUS: Record<StatusLeitura, string> = {
  pendente: 'Aguardando',
  lendo: 'Lendo…',
  concluida: 'Pronta',
  falhou: 'Falhou',
};

const ROTULOS_SITUACAO: Record<SituacaoLegislacao, string> = {
  vigente: 'Vigente',
  vigente_com_alteracoes: 'Vigente com alterações',
  revogada: 'Revogada',
};

export function rotuloStatusLeitura(status: StatusLeitura): string {
  return ROTULOS_STATUS[status];
}

export function rotuloSituacao(situacao: SituacaoLegislacao | null): string | null {
  return situacao ? ROTULOS_SITUACAO[situacao] : null;
}

/** Enquanto a leitura está em andamento a tela consulta a API de tempos em tempos. */
export function deveAtualizar(status: StatusLeitura): boolean {
  return status === 'pendente' || status === 'lendo';
}

/** Tom do StatusChip para cada estado da leitura. */
export function statusChipLeitura(status: StatusLeitura): string {
  switch (status) {
    case 'concluida':
      return 'concluida';
    case 'falhou':
      return 'atrasada';
    default:
      return 'pendente';
  }
}

export const OPCOES_SITUACAO: { value: SituacaoLegislacao; label: string }[] = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'vigente_com_alteracoes', label: 'Vigente com alterações' },
  { value: 'revogada', label: 'Revogada' },
];

export const OPCOES_STATUS_LEITURA: { value: StatusLeitura; label: string }[] = [
  { value: 'pendente', label: 'Aguardando' },
  { value: 'lendo', label: 'Lendo…' },
  { value: 'concluida', label: 'Pronta' },
  { value: 'falhou', label: 'Falhou' },
];

export const TAMANHO_MAXIMO_PDF = 20 * 1024 * 1024;
export const MINIMO_CARACTERES_TEXTO = 500;

/** Data em pt-BR; aceita AAAA-MM-DD sem deslocar o dia por fuso. */
export function formatarDataPtBr(valor?: string | null): string {
  if (!valor) return '—';
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(valor.slice(0, 10)) ? valor.slice(0, 10) : null;
  const data = soData ? new Date(`${soData}T12:00:00`) : new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR');
}
