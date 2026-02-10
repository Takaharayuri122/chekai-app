import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoUrlUsuarioCliente1739122800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS logo_url TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS logo_url TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE usuarios DROP COLUMN IF EXISTS logo_url`);
    await queryRunner.query(`ALTER TABLE clientes DROP COLUMN IF EXISTS logo_url`);
  }
}
