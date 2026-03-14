import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiplosAuditoresClienteUnidade1769600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cliente_auditores" (
        "cliente_id" UUID NOT NULL REFERENCES "clientes"("id") ON DELETE CASCADE,
        "auditor_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
        PRIMARY KEY ("cliente_id", "auditor_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "unidade_auditores" (
        "unidade_id" UUID NOT NULL REFERENCES "unidades"("id") ON DELETE CASCADE,
        "auditor_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
        PRIMARY KEY ("unidade_id", "auditor_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "unidades"
      ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) NOT NULL DEFAULT ''
    `);

    await queryRunner.query(`
      ALTER TABLE "unidades"
      ADD COLUMN IF NOT EXISTS "whatsapp" VARCHAR(20) NULL
    `);

    await queryRunner.query(`
      UPDATE "unidades" SET "responsavel" = '' WHERE "responsavel" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "unidades"
      ALTER COLUMN "responsavel" SET NOT NULL,
      ALTER COLUMN "responsavel" SET DEFAULT ''
    `);

    await queryRunner.query(`
      INSERT INTO "cliente_auditores" ("cliente_id", "auditor_id")
      SELECT "id", "auditor_id" FROM "clientes" WHERE "auditor_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "clientes" DROP COLUMN IF EXISTS "auditor_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clientes"
      ADD COLUMN "auditor_id" UUID NULL REFERENCES "usuarios"("id")
    `);

    await queryRunner.query(`
      UPDATE "clientes" c
      SET "auditor_id" = ca."auditor_id"
      FROM (
        SELECT DISTINCT ON ("cliente_id") "cliente_id", "auditor_id"
        FROM "cliente_auditores"
        ORDER BY "cliente_id"
      ) ca
      WHERE c."id" = ca."cliente_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "unidade_auditores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cliente_auditores"`);

    await queryRunner.query(`
      ALTER TABLE "unidades"
      ALTER COLUMN "responsavel" DROP NOT NULL,
      ALTER COLUMN "responsavel" DROP DEFAULT
    `);

    await queryRunner.query(`ALTER TABLE "unidades" DROP COLUMN IF EXISTS "whatsapp"`);
    await queryRunner.query(`ALTER TABLE "unidades" DROP COLUMN IF EXISTS "email"`);
  }
}
