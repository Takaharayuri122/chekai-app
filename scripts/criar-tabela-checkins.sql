-- Cria enum de status do checkin
DO $$
BEGIN
  CREATE TYPE checkins_status_enum AS ENUM ('aberto', 'fechado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Cria tabela de checkins
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL,
  cliente_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  status checkins_status_enum NOT NULL DEFAULT 'aberto',
  data_checkin TIMESTAMP NOT NULL,
  data_checkout TIMESTAMP,
  latitude_checkin NUMERIC(10, 8) NOT NULL,
  longitude_checkin NUMERIC(11, 8) NOT NULL,
  latitude_checkout NUMERIC(10, 8),
  longitude_checkout NUMERIC(11, 8),
  alerta_3h_emitido_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_checkins_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_checkins_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_checkins_unidade
    FOREIGN KEY (unidade_id) REFERENCES unidades(id)
);

-- Índices de apoio
CREATE INDEX IF NOT EXISTS idx_checkins_usuario_status ON checkins(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_checkins_cliente_id ON checkins(cliente_id);
CREATE INDEX IF NOT EXISTS idx_checkins_unidade_id ON checkins(unidade_id);
CREATE INDEX IF NOT EXISTS idx_checkins_data_checkin ON checkins(data_checkin);

-- Garante apenas um checkin aberto por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_usuario_aberto
  ON checkins(usuario_id)
  WHERE status = 'aberto';
