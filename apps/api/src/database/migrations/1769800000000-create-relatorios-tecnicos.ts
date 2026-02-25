import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRelatoriosTecnicos1769800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."relatorios_tecnicos_status_enum" AS ENUM('rascunho', 'finalizado');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relatorios_tecnicos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cliente_id" uuid NOT NULL,
        "unidade_id" uuid,
        "consultora_id" uuid NOT NULL,
        "identificacao" text NOT NULL,
        "descricao_ocorrencia_html" text NOT NULL,
        "avaliacao_tecnica_html" text NOT NULL,
        "acoes_executadas" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "recomendacoes_consultora_html" text NOT NULL,
        "plano_acao_sugerido_html" text NOT NULL,
        "apoio_analitico_chek_ai" text,
        "status" "public"."relatorios_tecnicos_status_enum" NOT NULL DEFAULT 'rascunho',
        "assinatura_nome_consultora" text NOT NULL DEFAULT '',
        "pdf_url" text,
        "pdf_gerado_em" TIMESTAMP,
        "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
        "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_relatorios_tecnicos_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "relatorios_tecnicos_fotos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "url" text NOT NULL,
        "nomeOriginal" character varying(255),
        "mimeType" character varying(50),
        "tamanhoBytes" integer,
        "exif" jsonb,
        "relatorio_tecnico_id" uuid NOT NULL,
        "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_relatorios_tecnicos_fotos_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos"
      ADD CONSTRAINT "FK_relatorios_tecnicos_cliente_id"
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos"
      ADD CONSTRAINT "FK_relatorios_tecnicos_unidade_id"
      FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos"
      ADD CONSTRAINT "FK_relatorios_tecnicos_consultora_id"
      FOREIGN KEY ("consultora_id") REFERENCES "usuarios"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos_fotos"
      ADD CONSTRAINT "FK_relatorios_tecnicos_fotos_relatorio_tecnico_id"
      FOREIGN KEY ("relatorio_tecnico_id") REFERENCES "relatorios_tecnicos"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos_fotos"
      DROP CONSTRAINT IF EXISTS "FK_relatorios_tecnicos_fotos_relatorio_tecnico_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos"
      DROP CONSTRAINT IF EXISTS "FK_relatorios_tecnicos_consultora_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos"
      DROP CONSTRAINT IF EXISTS "FK_relatorios_tecnicos_unidade_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "relatorios_tecnicos"
      DROP CONSTRAINT IF EXISTS "FK_relatorios_tecnicos_cliente_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "relatorios_tecnicos_fotos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "relatorios_tecnicos"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."relatorios_tecnicos_status_enum"`);
  }
}
