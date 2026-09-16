-- Comentário e flag de encerramento automático em checkins (RN-CKI-009/010)
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS comentario TEXT;

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS encerrado_automaticamente BOOLEAN NOT NULL DEFAULT false;
