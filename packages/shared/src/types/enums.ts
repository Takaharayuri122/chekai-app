export enum PerfilUsuario {
  MASTER = 'master',
  GESTOR = 'gestor',
  AUDITOR = 'auditor',
}

export enum StatusUsuario {
  NAO_CONFIRMADO = 'nao_confirmado',
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

export enum StatusAuditoria {
  RASCUNHO = 'rascunho',
  EM_ANDAMENTO = 'em_andamento',
  FINALIZADA = 'finalizada',
  CANCELADA = 'cancelada',
}

export enum RespostaItem {
  CONFORME = 'conforme',
  NAO_CONFORME = 'nao_conforme',
  NAO_APLICAVEL = 'nao_aplicavel',
  NAO_AVALIADO = 'nao_avaliado',
}

export enum StatusRelatorioTecnico {
  RASCUNHO = 'rascunho',
  FINALIZADO = 'finalizado',
}

export enum StatusCheckin {
  ABERTO = 'aberto',
  FECHADO = 'fechado',
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  CONFLICT = 'conflict',
}

export enum RiscoGeral {
  BAIXO = 'baixo',
  MEDIO = 'medio',
  ALTO = 'alto',
  CRITICO = 'critico',
}
