-- Adiciona coluna exif na tabela fotos para armazenar metadados EXIF (auditoria futura).
-- Execute apenas se a coluna ainda não existir (ex.: após deploy sem synchronize).

ALTER TABLE fotos
ADD COLUMN IF NOT EXISTS exif jsonb NULL;

COMMENT ON COLUMN fotos.exif IS 'Metadados EXIF extraídos da imagem (câmera, data, GPS, etc.) para auditoria.';
