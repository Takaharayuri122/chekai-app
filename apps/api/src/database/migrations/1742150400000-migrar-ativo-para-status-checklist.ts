import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrarAtivoParaStatusChecklist1742150400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checklist_templates_status_enum') THEN
          CREATE TYPE checklist_templates_status_enum AS ENUM ('rascunho', 'ativo', 'inativo');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE checklist_templates
      ADD COLUMN IF NOT EXISTS status checklist_templates_status_enum NOT NULL DEFAULT 'rascunho'
    `);

    await queryRunner.query(`UPDATE checklist_templates SET status = 'ativo' WHERE ativo = true`);
    await queryRunner.query(`UPDATE checklist_templates SET status = 'inativo' WHERE ativo = false`);

    await queryRunner.query(`ALTER TABLE checklist_templates DROP COLUMN IF EXISTS ativo`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true`);

    await queryRunner.query(`UPDATE checklist_templates SET ativo = true WHERE status = 'ativo'`);
    await queryRunner.query(`UPDATE checklist_templates SET ativo = false WHERE status IN ('inativo', 'rascunho')`);

    await queryRunner.query(`ALTER TABLE checklist_templates DROP COLUMN IF EXISTS status`);
    await queryRunner.query(`DROP TYPE IF EXISTS checklist_templates_status_enum`);
  }
}
