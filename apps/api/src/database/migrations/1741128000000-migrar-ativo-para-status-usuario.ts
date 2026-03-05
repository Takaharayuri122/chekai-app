import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrarAtivoParaStatusUsuario1741128000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usuarios_status_enum') THEN
          CREATE TYPE usuarios_status_enum AS ENUM ('nao_confirmado', 'ativo', 'inativo');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS status usuarios_status_enum NOT NULL DEFAULT 'ativo'
    `);

    await queryRunner.query(`UPDATE usuarios SET status = 'ativo' WHERE ativo = true`);
    await queryRunner.query(`UPDATE usuarios SET status = 'inativo' WHERE ativo = false`);

    await queryRunner.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS token_convite VARCHAR(255) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS token_convite_expires_at TIMESTAMP NULL
    `);

    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS ativo`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true`);

    await queryRunner.query(`UPDATE usuarios SET ativo = true WHERE status = 'ativo'`);
    await queryRunner.query(`UPDATE usuarios SET ativo = false WHERE status IN ('inativo', 'nao_confirmado')`);

    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS token_convite_expires_at`);
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS token_convite`);
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS status`);
    await queryRunner.query(`DROP TYPE IF EXISTS usuarios_status_enum`);
  }
}
