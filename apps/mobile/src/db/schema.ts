export const SCHEMA_VERSION = 1;

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
    template_id TEXT REFERENCES templates_auditoria(id),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS auditoria_itens (
    id TEXT PRIMARY KEY,
    remote_id TEXT,
    auditoria_id TEXT NOT NULL,
    template_item_id TEXT NOT NULL,
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
    unidade_id TEXT,
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
