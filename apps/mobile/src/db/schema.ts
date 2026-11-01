export const SCHEMA_VERSION = 9;

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

/**
 * V6 — Modelo personalizável do relatório técnico (RN-REL-012/013): snapshot do
 * modelo de relatórios finalizados vindo da API e aviso de finalização recusada.
 */
export const SCHEMA_V6 = `
  ALTER TABLE relatorios_tecnicos ADD COLUMN modelo_secoes TEXT;
  ALTER TABLE relatorios_tecnicos ADD COLUMN aviso_sync TEXT;
`;

/**
 * V7 — Inativação lógica de cliente/unidade: inativos não aparecem no fluxo de nova auditoria.
 */
export const SCHEMA_V7 = `
  ALTER TABLE clientes ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE unidades ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
`;

/**
 * V8 — Fila de sincronização com estados, dona (usuário) e erro; check-in/checkout offline.
 * `checkins` é recriada (era só cache) com coordenadas anuláveis e colunas de envio offline.
 */
export const SCHEMA_V8 = `
  ALTER TABLE sync_queue ADD COLUMN usuario_id TEXT;
  ALTER TABLE sync_queue ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';
  ALTER TABLE sync_queue ADD COLUMN ultimo_erro TEXT;
  ALTER TABLE sync_queue ADD COLUMN atualizado_em TEXT;
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
    latitude_checkin REAL,
    longitude_checkin REAL,
    latitude_checkout REAL,
    longitude_checkout REAL,
    alerta_3h_emitido_em TEXT,
    is_atrasado_3h INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    updated_at TEXT NOT NULL,
    local_id TEXT,
    checkin_offline INTEGER NOT NULL DEFAULT 0,
    checkin_sincronizado_em TEXT,
    checkout_offline INTEGER NOT NULL DEFAULT 0,
    checkout_sincronizado_em TEXT,
    envio_status TEXT,
    envio_erro TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_checkins_usuario_status ON checkins(usuario_id, status);
`;

/**
 * V9 — Um item por pergunta em cada auditoria. O pull inseria a cópia do servidor
 * (id do servidor) ao lado do item criado no aparelho (UUID local) para a mesma
 * pergunta. Remove as duplicatas mantendo, nesta ordem: o item com resposta real,
 * o item com foto local, o mais antigo (o do aparelho). Fotos locais do item removido
 * passam para o mantido; fotos só remotas da cópia saem (o servidor já as tem). Depois,
 * o índice único impede novas duplicatas.
 */
export const SCHEMA_V9 = `
  CREATE TEMP TABLE _itens_ordem AS
    SELECT ai.id, ai.auditoria_id, ai.template_item_id,
      ROW_NUMBER() OVER (
        PARTITION BY ai.auditoria_id, ai.template_item_id
        ORDER BY
          CASE WHEN ai.resposta != 'nao_avaliado' THEN 0 ELSE 1 END,
          CASE WHEN EXISTS (
            SELECT 1 FROM fotos f WHERE f.auditoria_item_id = ai.id AND f.file_path IS NOT NULL
          ) THEN 0 ELSE 1 END,
          ai.rowid
      ) AS ordem
    FROM auditoria_itens ai;
  UPDATE fotos SET auditoria_item_id = (
      SELECT mantido.id FROM _itens_ordem mantido
      JOIN _itens_ordem removido
        ON removido.auditoria_id = mantido.auditoria_id
       AND removido.template_item_id = mantido.template_item_id
      WHERE removido.id = fotos.auditoria_item_id AND mantido.ordem = 1
    )
    WHERE file_path IS NOT NULL
      AND auditoria_item_id IN (SELECT id FROM _itens_ordem WHERE ordem > 1);
  DELETE FROM fotos WHERE auditoria_item_id IN (SELECT id FROM _itens_ordem WHERE ordem > 1);
  DELETE FROM auditoria_itens WHERE id IN (SELECT id FROM _itens_ordem WHERE ordem > 1);
  DROP TABLE temp._itens_ordem;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_auditoria_itens_pergunta
    ON auditoria_itens(auditoria_id, template_item_id);
`;
