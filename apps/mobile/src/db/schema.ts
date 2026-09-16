export const SCHEMA_VERSION = 5;

export const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    perfil TEXT NOT NULL,
    status TEXT NOT NULL,
    tenant_id TEXT,
    logo_url TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT,
    tipo_atividade TEXT,
    logo_url TEXT,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS unidades (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    nome TEXT NOT NULL,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    latitude REAL,
    longitude REAL,
    raio_geofencing REAL NOT NULL DEFAULT 100,
    cliente_id TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  );

  CREATE TABLE IF NOT EXISTS checklist_templates (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    nome TEXT NOT NULL,
    descricao TEXT,
    tipo_atividade TEXT,
    versao TEXT NOT NULL DEFAULT '1.0',
    status TEXT NOT NULL DEFAULT 'ativo',
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS template_itens (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    template_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    referencia_legal TEXT,
    pontuacao_maxima INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (template_id) REFERENCES checklist_templates(id)
  );

  CREATE TABLE IF NOT EXISTS auditorias (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    local_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho',
    data_inicio TEXT,
    data_fim TEXT,
    latitude_inicio REAL,
    longitude_inicio REAL,
    latitude_fim REAL,
    longitude_fim REAL,
    observacoes_gerais TEXT,
    pontuacao_total REAL,
    resumo_executivo TEXT,
    pdf_url TEXT,
    cliente_id TEXT NOT NULL REFERENCES clientes(id),
    unidade_id TEXT NOT NULL REFERENCES unidades(id),
    template_id TEXT REFERENCES checklist_templates(id),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS auditoria_itens (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    auditoria_id TEXT NOT NULL,
    template_item_id TEXT NOT NULL REFERENCES template_itens(id),
    resposta TEXT NOT NULL DEFAULT 'nao_avaliado',
    observacao TEXT,
    descricao_nao_conformidade TEXT,
    descricao_ia TEXT,
    complemento_descricao TEXT,
    plano_acao_sugerido TEXT,
    plano_acao_final TEXT,
    referencia_legal TEXT,
    pontuacao INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (auditoria_id) REFERENCES auditorias(id)
  );

  CREATE TABLE IF NOT EXISTS fotos (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    auditoria_item_id TEXT NOT NULL,
    file_path TEXT,
    url TEXT,
    tamanho_bytes INTEGER,
    analise_ia TEXT,
    latitude REAL,
    longitude REAL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (auditoria_item_id) REFERENCES auditoria_itens(id)
  );

  CREATE TABLE IF NOT EXISTS relatorios_tecnicos (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    local_id TEXT NOT NULL,
    cliente_id TEXT NOT NULL REFERENCES clientes(id),
    unidade_id TEXT, -- nullable: relatório pode não estar vinculado a uma unidade específica
    identificacao TEXT NOT NULL,
    descricao_ocorrencia_html TEXT,
    avaliacao_tecnica_html TEXT,
    acoes_executadas TEXT,
    recomendacoes_html TEXT,
    plano_acao_html TEXT,
    apoio_analitico TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    assinatura_nome TEXT,
    responsavel TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS relatorio_fotos (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    relatorio_id TEXT NOT NULL,
    file_path TEXT,
    url TEXT,
    descricao TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (relatorio_id) REFERENCES relatorios_tecnicos(id)
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    local_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id),
    cliente_id TEXT NOT NULL REFERENCES clientes(id),
    unidade_id TEXT NOT NULL REFERENCES unidades(id),
    status TEXT NOT NULL DEFAULT 'aberto',
    data_checkin TEXT NOT NULL,
    data_checkout TEXT,
    latitude_checkin REAL NOT NULL,
    longitude_checkin REAL NOT NULL,
    latitude_checkout REAL,
    longitude_checkout REAL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    file_path TEXT,
    retries INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    entity TEXT PRIMARY KEY,
    last_synced_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_auditorias_status ON auditorias(status);
  CREATE INDEX IF NOT EXISTS idx_auditorias_sync ON auditorias(sync_status);
  CREATE INDEX IF NOT EXISTS idx_auditoria_itens_auditoria ON auditoria_itens(auditoria_id);
  CREATE INDEX IF NOT EXISTS idx_fotos_item ON fotos(auditoria_item_id);
  CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity);
  CREATE INDEX IF NOT EXISTS idx_unidades_cliente ON unidades(cliente_id);
`;

export const SCHEMA_V2 = `
  ALTER TABLE template_itens ADD COLUMN categoria TEXT;
  ALTER TABLE template_itens ADD COLUMN tipo_resposta TEXT NOT NULL DEFAULT 'padrao';
  ALTER TABLE template_itens ADD COLUMN opcoes_resposta_config TEXT;
  ALTER TABLE template_itens ADD COLUMN foto_obrigatoria INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE template_itens ADD COLUMN observacao_obrigatoria INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE template_itens ADD COLUMN criticidade TEXT;
  ALTER TABLE auditorias ADD COLUMN analise_ia TEXT;
  ALTER TABLE auditorias ADD COLUMN assinatura_nome TEXT;
`;

export const SCHEMA_V3 = `
  ALTER TABLE auditorias ADD COLUMN pdf_local_path TEXT;
  ALTER TABLE auditorias ADD COLUMN resumo_executivo_gerado_em TEXT;
`;

export const SCHEMA_V4 = `
  ALTER TABLE relatorios_tecnicos ADD COLUMN pdf_url TEXT;
  ALTER TABLE relatorios_tecnicos ADD COLUMN pdf_local_path TEXT;
  CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_sync ON relatorios_tecnicos(sync_status);
  CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_status ON relatorios_tecnicos(status);
  CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_cliente ON relatorios_tecnicos(cliente_id);
  CREATE INDEX IF NOT EXISTS idx_relatorio_fotos_relatorio ON relatorio_fotos(relatorio_id);
`;

/**
 * V5 — Check-in. O check-in/checkout é online-only (validação de unidade, gestor e
 * regra de "apenas 1 aberto" ocorrem no servidor — RN-CKI-001/002/003), portanto a
 * tabela local serve apenas como cache de leitura do check-in aberto do usuário.
 * A tabela original (V1) referenciava `usuarios`, que não é populada no app, e cujo
 * FK (com `foreign_keys = ON`) bloquearia inserções; como a tabela está sem uso, ela
 * é recriada sem chaves estrangeiras e com colunas de exibição (nomes) e de alerta.
 */
export const SCHEMA_V5 = `
  DROP TABLE IF EXISTS checkins;
  CREATE TABLE checkins (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    usuario_id TEXT NOT NULL,
    cliente_id TEXT NOT NULL,
    cliente_nome TEXT,
    unidade_id TEXT NOT NULL,
    unidade_nome TEXT,
    status TEXT NOT NULL DEFAULT 'aberto',
    data_checkin TEXT NOT NULL,
    data_checkout TEXT,
    latitude_checkin REAL NOT NULL,
    longitude_checkin REAL NOT NULL,
    latitude_checkout REAL,
    longitude_checkout REAL,
    alerta_3h_emitido_em TEXT,
    is_atrasado_3h INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_checkins_usuario_status ON checkins(usuario_id, status);
`;
