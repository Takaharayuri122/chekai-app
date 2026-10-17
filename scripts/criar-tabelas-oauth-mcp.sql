CREATE TABLE IF NOT EXISTS oauth_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL UNIQUE,
  nome VARCHAR(255),
  redirect_uris JSONB NOT NULL,
  origem VARCHAR(16) NOT NULL CHECK (origem IN ('cimd', 'registro')),
  documento JSONB,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_sessoes_consentimento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessao_hash VARCHAR(64) NOT NULL UNIQUE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_sessoes_usuario ON oauth_sessoes_consentimento(usuario_id);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_hash VARCHAR(64) NOT NULL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES oauth_clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method VARCHAR(8) NOT NULL DEFAULT 'S256',
  resource TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_usuario ON oauth_authorization_codes(usuario_id);

CREATE TABLE IF NOT EXISTS oauth_concessoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES oauth_clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  scopes TEXT NOT NULL,
  revogada_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_concessoes_usuario ON oauth_concessoes(usuario_id);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  concessao_id UUID NOT NULL REFERENCES oauth_concessoes(id) ON DELETE CASCADE,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  revogado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_concessao ON oauth_refresh_tokens(concessao_id);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jti UUID NOT NULL UNIQUE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  concessao_id UUID NOT NULL REFERENCES oauth_concessoes(id) ON DELETE CASCADE,
  expira_em TIMESTAMP NOT NULL,
  revogado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oauth_access_concessao ON oauth_access_tokens(concessao_id);
